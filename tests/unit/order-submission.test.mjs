import { test, expect, vi } from "vitest";
import {
  createOrderSubmissionService,
  assertOrderSubmissionReady,
} from "../../apps/api/dist/modules/orders/index.js";
import { orderSubmissionEnabled } from "../../apps/api/dist/app/order-submission-config.js";
import { createOrderSubmissionClient } from "../../apps/web/src/features/orders/submission-api.ts";
const id = "91000000-0000-4000-8000-000000000001",
  shade = "91000000-0000-4000-8000-000000000002",
  actor = { accountId: id, sessionId: id };
const input = {
  patient: { internal_reference: "Synthetic" },
  requested_delivery_date: "2026-11-01",
  material_id: id,
  shade_id: shade,
  teeth: [{ fdi: 11, selection: "pontic" }],
  file_ids: [],
};
const command = { input, idempotency_key: id, confirmed_warnings: false };
// Transactional state double: tests orchestration, NOT actual PostgreSQL locking/constraints.
function fixture(patch = {}) {
  const state = { writes: [], receipt: null, order: null },
    calls = [];
  let queue = Promise.resolve();
  const transaction = vi.fn((fn) => {
    const task = queue.then(async () => {
      const draft = { ...state, writes: [...state.writes] };
      const query = async (sql, values = []) => {
        calls.push([sql, values]);
        if (sql.startsWith("SELECT a.profile"))
          return {
            rows: patch.denied
              ? []
              : [
                  {
                    profile: patch.profile ?? "clinic",
                    lifecycle: "active",
                    sessionValid: true,
                    securityLocked: false,
                    resetRequired: false,
                    clinicId: id,
                    clinicSuspended: false,
                    grants: [],
                  },
                ],
          };
        if (
          sql.startsWith(
            "SELECT id FROM public.clinics WHERE account_id=$1 AND",
          )
        )
          return { rows: patch.unapproved ? [] : [{ id }] };
        if (sql.startsWith("SELECT r.payload_fingerprint"))
          return {
            rows: draft.receipt
              ? [{ ...draft.order, payload_fingerprint: draft.receipt }]
              : [],
          };
        if (sql.startsWith("SELECT id,kind,label"))
          return {
            rows: [
              {
                id,
                kind: "material",
                label: patch.removed ? null : "Synthetic material",
                revision: "3",
                state: patch.state ?? "available",
              },
              {
                id: shade,
                kind: "shade",
                label: "Synthetic shade",
                revision: "2",
                state: "available",
              },
            ],
          };
        if (sql.includes("FROM public.file_objects"))
          return { rows: patch.files ?? [] };
        if (sql.includes("FROM public.upload_sessions"))
          return { rows: patch.uploads ?? [] };
        if (sql.startsWith("SELECT file_id FROM public.order_version_files"))
          return { rows: patch.bound ? [{ file_id: id }] : [] };
        if (sql.startsWith("UPDATE public.upload_sessions")) {
          if (patch.expiredAtAttach) return { rows: [] };
          draft.writes.push([sql, values]);
          return { rows: [{ id }] };
        }
        if (sql.startsWith("INSERT")) {
          if (patch.failAt && sql.includes(patch.failAt))
            throw new Error("SYNTHETIC_FAILURE");
          draft.writes.push([sql, values]);
          if (sql.startsWith("INSERT INTO public.orders(")) {
            draft.order = {
              order_id: values[0],
              number: "9007199254740993",
              received_at: new Date("2026-10-16T12:00:00Z"),
            };
            return { rows: [draft.order] };
          }
          if (sql.startsWith("INSERT INTO public.internal_notifications"))
            return { rows: patch.noOwnerNotice ? [] : [{ id }] };
          if (sql.startsWith("INSERT INTO public.submission_receipts"))
            draft.receipt = values[2];
        }
        return { rows: [] };
      };
      const result = await fn({ query });
      if (patch.commitFailure) throw new Error("COMMIT_UNCERTAIN");
      Object.assign(state, draft);
      if (patch.lostResponseAfterCommit && !draft.receiptReported) {
        state.receiptReported = true;
        throw new Error("SYNTHETIC_RESPONSE_LOST_AFTER_COMMIT");
      }
      return result;
    });
    queue = task.catch(() => {});
    return task;
  });
  return { transaction, state, calls };
}
test("official submission writes all aggregate records in one transaction using server snapshots and identity defaults", async () => {
  const db = fixture(),
    r = await createOrderSubmissionService(db).submit(actor, command);
  expect(r).toMatchObject({
    kind: "result",
    result: {
      kind: "submitted",
      persisted: true,
      number: "9007199254740993",
      received_at: "2026-10-16T12:00:00.000Z",
      replayed: false,
    },
  });
  expect(db.transaction).toHaveBeenCalledTimes(1);
  const sql = db.state.writes.map(([s]) => s).join("\n");
  for (const table of [
    "catalog_reference_snapshots",
    "orders",
    "order_versions",
    "order_version_teeth",
    "order_logistics",
    "order_status_events",
    "conversations",
    "conversation_reads",
    "message_reminder_cycles",
    "outbox_events",
    "outbox_dispatches",
    "audit_events",
    "submission_receipts",
  ])
    expect(sql).toContain("INSERT INTO public." + table + "(");
  expect(
    db.state.writes
      .find(([s]) => s.includes("catalog_reference_snapshots"))[1]
      .slice(1),
  ).toEqual([id, "material", "Synthetic material", 3]);
  expect(
    db.state.writes
      .find(([s]) => s.includes("order_version_teeth"))[1]
      .slice(-2),
  ).toEqual([11, "pontic"]);
  expect(
    db.calls.findIndex(([s]) => s.includes("ORDER BY id FOR SHARE")),
  ).toBeLessThan(db.calls.findIndex(([s]) => s.startsWith("INSERT")));
  const audit = db.state.writes.find(([s]) => s.includes("audit_events"));
  expect(JSON.stringify(audit)).not.toContain("Synthetic");
});
test("same receipt replays without writes or catalogue checks; mismatched payload conflicts", async () => {
  const db = fixture(),
    service = createOrderSubmissionService(db);
  await service.submit(actor, command);
  const count = db.state.writes.length;
  db.calls.length = 0;
  expect((await service.submit(actor, command)).result).toMatchObject({
    kind: "submitted",
    replayed: true,
  });
  expect(db.state.writes).toHaveLength(count);
  expect(db.calls.some(([s]) => s.includes("catalog_effective_states"))).toBe(
    false,
  );
  expect(
    (
      await service.submit(actor, {
        ...command,
        input: { ...input, description: "Different" },
      })
    ).result.kind,
  ).toBe("conflict");
  expect(db.state.writes).toHaveLength(count);
});
test("lost response after commit is reconciled with the same key without a second order", async () => {
  const db = fixture({ lostResponseAfterCommit: true });
  const service = createOrderSubmissionService(db);
  await expect(service.submit(actor, command)).rejects.toThrow(
    "SYNTHETIC_RESPONSE_LOST_AFTER_COMMIT",
  );
  const before = db.state.writes.length;
  const replay = await service.submit(actor, command);
  expect(replay.result).toMatchObject({
    kind: "submitted",
    persisted: true,
    replayed: true,
  });
  expect(db.state.writes).toHaveLength(before);
  expect(
    db.state.writes.filter(([sql]) =>
      sql.startsWith("INSERT INTO public.orders("),
    ),
  ).toHaveLength(1);
});

test("two concurrent intents with same key serialize and yield one aggregate in transactional double", async () => {
  const db = fixture(),
    service = createOrderSubmissionService(db);
  const results = await Promise.all([
    service.submit(actor, command),
    service.submit(actor, command),
  ]);
  expect(results.map((r) => r.result.replayed)).toEqual([false, true]);
  expect(new Set(results.map((r) => r.result.order_id)).size).toBe(1);
  expect(
    db.state.writes.filter(([s]) => s.startsWith("INSERT INTO public.orders(")),
  ).toHaveLength(1);
  expect(db.calls[0][0]).toBe(
    "SELECT id FROM public.accounts WHERE id=$1 FOR UPDATE",
  );
});
test("failure at every write boundary rolls back the transactional double; no success escapes uncertain commit", async () => {
  const success = fixture();
  await createOrderSubmissionService(success).submit(actor, command);
  const tables = [
    ...new Set(
      success.state.writes.map(
        ([s]) => s.match(/INSERT INTO public\.([^ (]+)/)[1],
      ),
    ),
  ];
  for (const table of tables) {
    const db = fixture({ failAt: "public." + table + "(" });
    await expect(
      createOrderSubmissionService(db).submit(actor, command),
    ).rejects.toThrow("SYNTHETIC_FAILURE");
    expect(db.state.writes).toEqual([]);
    expect(db.state.receipt).toBeNull();
  }
  const db = fixture({ commitFailure: true });
  await expect(
    createOrderSubmissionService(db).submit(actor, command),
  ).rejects.toThrow("COMMIT_UNCERTAIN");
  expect(db.transaction).toHaveBeenCalledTimes(1);
});
test("current clinic authority, strict input, forbidden and unverified files prevent writes", async () => {
  for (const patch of [
    { denied: true },
    { unapproved: true },
    { profile: "admin" },
  ]) {
    const db = fixture(patch);
    expect(
      (await createOrderSubmissionService(db).submit(actor, command)).kind,
    ).toBe("denied");
    expect(db.state.writes).toEqual([]);
  }
  for (const [patch, cmd, reason] of [
    [{ state: "forbidden" }, command, "catalog_forbidden"],
    [{ removed: true }, command, "catalog_missing"],
    [
      {},
      { ...command, input: { ...input, file_ids: [id] } },
      "files_not_ready",
    ],
  ]) {
    const db = fixture(patch);
    expect(
      (await createOrderSubmissionService(db).submit(actor, cmd)).result,
    ).toMatchObject({ kind: "blocked", reasons: [reason] });
    expect(db.state.writes).toEqual([]);
  }
  const db = fixture();
  for (const patch of [
    { clinic_id: id },
    { number: "1" },
    { input: { ...input, patient: {} } },
    { input: { ...input, teeth: [{ fdi: 19, selection: "normal" }] } },
  ])
    expect(
      (
        await createOrderSubmissionService(db).submit(actor, {
          ...command,
          ...patch,
        })
      ).kind,
    ).toBe("invalid");
  expect(db.transaction).not.toHaveBeenCalled();
});
test("unavailable and no detail warn without inventing mandatory teeth or description", async () => {
  const db = fixture({ state: "unavailable" }),
    service = createOrderSubmissionService(db),
    cmd = { ...command, input: { ...input, teeth: [] } };
  expect((await service.submit(actor, cmd)).result).toMatchObject({
    kind: "confirmation_required",
    warnings: ["catalog_unavailable", "low_detail"],
  });
  expect(db.state.writes).toEqual([]);
  expect(
    (await service.submit(actor, { ...cmd, confirmed_warnings: true })).result
      .kind,
  ).toBe("submitted");
});
test("client rejects false receipts and never retries automatically; feature and readiness fail closed", async () => {
  const fetcher = vi.fn(
    async () =>
      new globalThis.Response(
        JSON.stringify({ kind: "submitted", persisted: false }),
        {
          status: 200,
        },
      ),
  );
  await expect(
    createOrderSubmissionClient(fetcher).submit(
      command,
      new globalThis.AbortController().signal,
    ),
  ).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    cache: "no-store",
    redirect: "error",
    credentials: "same-origin",
  });
  expect(orderSubmissionEnabled({})).toBe(false);
  expect(() =>
    orderSubmissionEnabled({ DENTAL_LAB_ORDER_SUBMISSION_ENABLED: "true" }),
  ).toThrow();
  await expect(
    assertOrderSubmissionReady({
      query: async () => ({ rows: [{ ready: false }] }),
    }),
  ).rejects.toThrow("ORDER_SUBMISSION_STORAGE_NOT_READY");
  await expect(
    assertOrderSubmissionReady({
      query: async () => ({ rows: [{ ready: true }] }),
    }),
  ).resolves.toBeUndefined();
});

const attachmentPolicy = {
  storagePolicyVersion: "test-storage",
  capacityPolicyVersion: "test-capacity",
};
const readyFile = {
  id,
  clinic_id: id,
  created_by: id,
  state: "ready",
  size_bytes: "3",
  content_sha256: Buffer.alloc(32),
  media_type_verified: "model/stl",
  verified_at: new Date(),
  storage_policy_version: "test-storage",
};
const readyUpload = {
  id,
  file_id: id,
  revision: "1",
  declared_size: "3",
  received_bytes: "3",
};
const attachedCommand = { ...command, input: { ...input, file_ids: [id] } };
test("files are attached with order, audit and receipt in the same transaction; replay never rebinds", async () => {
  const db = fixture({ files: [readyFile], uploads: [readyUpload] });
  const service = createOrderSubmissionService(db, attachmentPolicy);
  expect((await service.submit(actor, attachedCommand)).result.kind).toBe(
    "submitted",
  );
  const binding = db.state.writes.find(([s]) =>
    s.startsWith("INSERT INTO public.order_version_files"),
  );
  expect(binding[1].slice(2)).toEqual([id, id, actor.accountId]);
  expect(db.state.writes.some(([s]) => s.includes("file_events"))).toBe(true);
  const before = db.state.writes.length;
  expect((await service.submit(actor, attachedCommand)).result.replayed).toBe(
    true,
  );
  expect(db.state.writes).toHaveLength(before);
  const query = db.calls.find(([s]) =>
    s.includes("FROM public.upload_sessions"),
  );
  expect(query[0]).toContain("expires_at>statement_timestamp()");
  expect(query[0]).toContain("intended_order_id IS NOT DISTINCT FROM");
  expect(query[1]).toEqual([[id], id, actor.accountId, null, "test-capacity"]);
});
test("wrong clinic/owner, quarantined, missing integrity, duplicate bindings and expired sessions refuse before writes", async () => {
  const patches = [
    { files: [{ ...readyFile, clinic_id: shade }] },
    { files: [{ ...readyFile, created_by: shade }] },
    { files: [{ ...readyFile, state: "quarantined" }] },
    { files: [{ ...readyFile, content_sha256: null }] },
    { files: [{ ...readyFile, storage_policy_version: "other" }] },
    { files: [{ ...readyFile, size_bytes: "200000001" }] },
    { uploads: [] },
    { uploads: [{ ...readyUpload, received_bytes: "2" }] },
    { bound: true },
  ];
  for (const patch of patches) {
    const db = fixture({
      files: [readyFile],
      uploads: [readyUpload],
      ...patch,
    });
    expect(
      (
        await createOrderSubmissionService(db, attachmentPolicy).submit(
          actor,
          attachedCommand,
        )
      ).result,
    ).toMatchObject({ kind: "blocked", reasons: ["files_not_ready"] });
    expect(db.state.writes).toEqual([]);
  }
});
test("attachment, audit and later aggregate failures roll back all writes in transaction double", async () => {
  for (const patch of [
    { expiredAtAttach: true },
    { failAt: "public.order_version_files(" },
    { failAt: "public.file_events(" },
    { failAt: "public.submission_receipts(" },
  ]) {
    const db = fixture({
      files: [readyFile],
      uploads: [readyUpload],
      ...patch,
    });
    await expect(
      createOrderSubmissionService(db, attachmentPolicy).submit(
        actor,
        attachedCommand,
      ),
    ).rejects.toThrow();
    expect(db.state.writes).toEqual([]);
    expect(db.state.receipt).toBeNull();
  }
});

test("closed notice flag leaves submission unchanged; enabled owner notice is transactional and idempotent", async () => {
  const disabled = fixture();
  await createOrderSubmissionService(disabled).submit(actor, command);
  expect(
    disabled.state.writes.some(([sql]) =>
      sql.includes("internal_notifications"),
    ),
  ).toBe(false);
  const db = fixture();
  const service = createOrderSubmissionService(db, undefined, true);
  const first = await service.submit(actor, command);
  expect(first.result.kind).toBe("submitted");
  const notices = db.state.writes.filter(([sql]) =>
    sql.startsWith("INSERT INTO public.internal_notifications"),
  );
  expect(notices).toHaveLength(1);
  const event = db.state.writes.find(([sql]) =>
    sql.startsWith("INSERT INTO public.outbox_events"),
  );
  expect(notices[0][1]).toEqual([event[1][0]]);
  expect(notices[0][0]).toContain("a.profile='owner'");
  expect(notices[0][0]).toContain("NOT a.security_locked");
  expect((await service.submit(actor, command)).result.replayed).toBe(true);
  expect(
    db.state.writes.filter(([sql]) =>
      sql.startsWith("INSERT INTO public.internal_notifications"),
    ),
  ).toHaveLength(1);
  for (const patch of [
    { noOwnerNotice: true },
    { failAt: "public.internal_notifications(" },
  ]) {
    const failed = fixture(patch);
    await expect(
      createOrderSubmissionService(failed, undefined, true).submit(
        actor,
        command,
      ),
    ).rejects.toThrow();
    expect(failed.state.writes).toEqual([]);
    expect(failed.state.receipt).toBeNull();
  }
});
