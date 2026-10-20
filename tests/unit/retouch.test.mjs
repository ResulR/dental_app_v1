import { test, expect, vi } from "vitest";
import {
  createRetouchService,
  assertRetouchReady,
} from "../../apps/api/dist/modules/linked-works/index.js";
import { retouchEnabled } from "../../apps/api/dist/app/retouch-config.js";
import { createRetouchClient } from "../../apps/web/src/features/orders/retouch-api.ts";
const id = "93000000-0000-4000-8000-000000000001",
  shade = "93000000-0000-4000-8000-000000000002",
  actor = { accountId: id, sessionId: id };
const input = {
  source_order_id: id,
  expected_source_version_id: id,
  expected_source_revision: 1,
  intervention_kind: "retouch",
  material_id: id,
  shade_id: shade,
  description: "Synthetic problem affecting tooth 11",
  file_ids: [],
};
const command = { input, idempotency_key: id, confirmed_warnings: false };
// Transactional state double: tests orchestration, NOT actual PostgreSQL locking/constraints.
function fixture(patch = {}) {
  const state = {
      writes: [],
      receipts: {},
      order: null,
      childStatus: patch.childStatus ?? null,
      sourceStatus: patch.sourceStatus ?? "delivered",
    },
    calls = [];
  let queue = Promise.resolve();
  const transaction = vi.fn((fn) => {
    const task = queue.then(async () => {
      const draft = {
        ...state,
        receipts: { ...state.receipts },
        writes: [...state.writes],
      };
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
            rows: draft.receipts[values[1]] ? [draft.receipts[values[1]]] : [],
          };
        if (sql.startsWith("SELECT id FROM public.orders WHERE"))
          return { rows: patch.foreign ? [] : [{ id: values[0] }] };
        if (sql.startsWith("SELECT id,status,current_version_id"))
          return {
            rows: [
              {
                id: values[0],
                status: draft.sourceStatus,
                current_version_id: id,
                revision: patch.stale ? "2" : "1",
              },
            ],
          };
        if (sql.startsWith("SELECT child_order_id"))
          return {
            rows: [
              "pending",
              "correction_requested",
              "accepted",
              "manufacturing",
              "completed",
            ].includes(draft.childStatus)
              ? [{ child_order_id: shade }]
              : [],
          };
        if (sql.startsWith("SELECT patient_first_name"))
          return {
            rows: [
              {
                patient_first_name: null,
                patient_last_name: null,
                patient_reference: "Synthetic parent",
              },
            ],
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
          return { rows: [] };
        if (sql.startsWith("UPDATE public.upload_sessions")) {
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
          if (sql.startsWith("INSERT INTO public.submission_receipts"))
            draft.receipts[values[2]] = {
              ...draft.order,
              payload_fingerprint: values[3],
            };
          if (sql.startsWith("INSERT INTO public.work_links")) {
            if (patch.unique) throw { code: "23505", constraint: patch.unique };
            draft.childStatus = "pending";
          }
        }
        return { rows: [] };
      };
      const result = await fn({ query });
      if (patch.commitFailure) throw new Error("COMMIT_UNCERTAIN");
      Object.assign(state, draft);
      return result;
    });
    queue = task.catch(() => {});
    return task;
  });
  return { transaction, state, calls };
}

test("creates a distinct numbered child and conversation linked to the actual delivered source, never mutates source", async () => {
  const db = fixture(),
    r = await createRetouchService(db).submit(actor, command);
  expect(r.result).toMatchObject({
    kind: "submitted",
    persisted: true,
    replayed: false,
    number: "9007199254740993",
  });
  expect(r.result.order_id).not.toBe(id);
  const writes = db.state.writes,
    sql = writes.map(([s]) => s).join("\n");
  for (const table of [
    "catalog_reference_snapshots",
    "orders",
    "order_versions",
    "order_logistics",
    "order_status_events",
    "conversations",
    "conversation_reads",
    "message_reminder_cycles",
    "outbox_events",
    "outbox_dispatches",
    "audit_events",
    "submission_receipts",
    "work_links",
  ])
    expect(sql).toContain("INSERT INTO public." + table + "(");
  expect(sql).not.toContain("order_version_teeth");
  expect(sql).not.toMatch(/UPDATE|DELETE/);
  const version = writes.find(([s]) =>
    s.startsWith("INSERT INTO public.order_versions"),
  )[1];
  expect(version[6]).toBe("Synthetic parent");
  expect(version[9]).toBe(null);
  expect(version[11]).toBe(null);
  const link = writes.find(([s]) =>
    s.startsWith("INSERT INTO public.work_links"),
  )[1];
  expect(link.slice(0, 4)).toEqual([id, r.result.order_id, id, "retouch"]);
  expect(link[6]).toBe(
    writes.find(([s]) =>
      s.startsWith("INSERT INTO public.submission_receipts"),
    )[1][0],
  );
  expect(sql).toContain("'retouch_requested'");
  expect(
    JSON.stringify(writes.find(([s]) => s.includes("audit_events"))),
  ).not.toContain("Synthetic");
  expect(
    db.calls.findIndex(([s]) => s.includes("ORDER BY id FOR SHARE")),
  ).toBeLessThan(
    db.calls.findIndex(
      ([s]) => s.includes("FROM public.orders") && s.endsWith("FOR UPDATE"),
    ),
  );
});
test("same key replays after source changes; different payload conflicts; two concurrent keys yield one active child", async () => {
  const db = fixture(),
    service = createRetouchService(db);
  const first = await service.submit(actor, command);
  const count = db.state.writes.length;
  db.state.sourceStatus = "completed";
  db.calls.length = 0;
  expect((await service.submit(actor, command)).result).toMatchObject({
    kind: "submitted",
    replayed: true,
    order_id: first.result.order_id,
  });
  expect(db.state.writes).toHaveLength(count);
  expect(db.calls.some(([s]) => s.includes("FROM public.orders WHERE"))).toBe(
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
  const same = fixture(),
    s = createRetouchService(same);
  expect(
    (
      await Promise.all([s.submit(actor, command), s.submit(actor, command)])
    ).map((r) => r.result.replayed),
  ).toEqual([false, true]);
  const different = fixture(),
    d = createRetouchService(different);
  expect(
    (
      await Promise.all([
        d.submit(actor, command),
        d.submit(actor, { ...command, idempotency_key: shade }),
      ])
    ).map((r) => r.result.kind),
  ).toEqual(["submitted", "active_retouch"]);
});
test("only approved owning clinic with a current delivered version can request", async () => {
  for (const patch of [
    { denied: true },
    { unapproved: true },
    { profile: "employee" },
    { foreign: true },
  ]) {
    const db = fixture(patch);
    expect((await createRetouchService(db).submit(actor, command)).kind).toBe(
      "denied",
    );
    expect(db.state.writes).toEqual([]);
    expect(
      db.calls.some(([s]) => s.startsWith("SELECT patient_first_name")),
    ).toBe(false);
  }
  for (const patch of [
    { sourceStatus: "cancelled" },
    { sourceStatus: "rejected" },
    { sourceStatus: "completed" },
    { sourceStatus: "manufacturing" },
    { sourceStatus: "pending" },
    { stale: true },
  ]) {
    const db = fixture(patch);
    expect(
      (await createRetouchService(db).submit(actor, command)).result.kind,
    ).toBe("source_unavailable");
    expect(db.state.writes).toEqual([]);
  }
  const db = fixture();
  expect(
    (
      await createRetouchService(db).submit(actor, {
        ...command,
        input: { ...input, expected_source_version_id: shade },
      })
    ).result.kind,
  ).toBe("source_unavailable");
});
test("one active retouch blocks all active states; terminal states allow a new linked work", async () => {
  for (const childStatus of [
    "pending",
    "correction_requested",
    "accepted",
    "manufacturing",
    "completed",
  ]) {
    const db = fixture({ childStatus });
    expect(
      (await createRetouchService(db).submit(actor, command)).result.kind,
    ).toBe("active_retouch");
    expect(db.state.writes).toEqual([]);
  }
  for (const childStatus of ["rejected", "cancelled", "delivered"]) {
    const db = fixture({ childStatus });
    expect(
      (
        await createRetouchService(db).submit(actor, {
          ...command,
          input: {
            ...input,
            source_order_id: shade,
            intervention_kind: "remanufacture",
          },
        })
      ).result.kind,
    ).toBe("submitted");
    expect(
      db.state.writes.find(([s]) =>
        s.startsWith("INSERT INTO public.work_links"),
      )[1][0],
    ).toBe(shade);
  }
});
test("problem mandatory, no patient/FDI injection, catalog and file guards fail closed", async () => {
  for (const bad of [
    { ...input, description: " " },
    { ...input, teeth: [{ fdi: 11, selection: "normal" }] },
    { ...input, patient: { internal_reference: "Forged" } },
  ]) {
    const db = fixture();
    expect(
      (await createRetouchService(db).submit(actor, { ...command, input: bad }))
        .kind,
    ).toBe("invalid");
    expect(db.transaction).not.toHaveBeenCalled();
  }
  for (const [patch, changed, kind] of [
    [{ state: "forbidden" }, input, "blocked"],
    [{ removed: true }, input, "blocked"],
    [{}, { ...input, file_ids: [id] }, "blocked"],
    [{ state: "unavailable" }, input, "confirmation_required"],
  ]) {
    const db = fixture(patch);
    expect(
      (
        await createRetouchService(db).submit(actor, {
          ...command,
          input: changed,
        })
      ).result.kind,
    ).toBe(kind);
    expect(db.state.writes).toEqual([]);
  }
  expect(
    (
      await createRetouchService(fixture({ state: "unavailable" })).submit(
        actor,
        { ...command, confirmed_warnings: true },
      )
    ).result.kind,
  ).toBe("submitted");
});
test("each aggregate write failure rolls back; only exact active-slot collision is translated after rollback", async () => {
  for (const failAt of [
    "catalog_reference_snapshots",
    "public.orders(",
    "order_versions",
    "order_logistics",
    "order_status_events",
    "conversations",
    "conversation_reads",
    "message_reminder_cycles",
    "outbox_events",
    "outbox_dispatches",
    "audit_events",
    "submission_receipts",
    "work_links",
  ]) {
    const db = fixture({ failAt });
    await expect(
      createRetouchService(db).submit(actor, command),
    ).rejects.toThrow("SYNTHETIC_FAILURE");
    expect(db.state.writes).toEqual([]);
    expect(db.state.receipts).toEqual({});
    expect(db.state.order).toBe(null);
  }
  const db = fixture({ unique: "work_links_one_active_retouch_idx" });
  expect(
    (await createRetouchService(db).submit(actor, command)).result.kind,
  ).toBe("active_retouch");
  expect(db.state.writes).toEqual([]);
  await expect(
    createRetouchService(
      fixture({ unique: "unrelated_integrity_constraint" }),
    ).submit(actor, command),
  ).rejects.toMatchObject({
    code: "23505",
    constraint: "unrelated_integrity_constraint",
  });
  const uncertain = fixture({ commitFailure: true });
  await expect(
    createRetouchService(uncertain).submit(actor, command),
  ).rejects.toThrow("COMMIT_UNCERTAIN");
  expect(uncertain.state.writes).toEqual([]);
});
test("feature remains off and readiness rejects missing privileges/index; client never fabricates success or retries", async () => {
  expect(retouchEnabled({})).toBe(false);
  expect(() =>
    retouchEnabled({ DENTAL_LAB_RETOUCH_ENABLED: "true" }),
  ).toThrow();
  expect(
    retouchEnabled({
      DENTAL_LAB_RETOUCH_ENABLED: "true",
      DENTAL_LAB_ORDER_EDIT_ENABLED: "true",
      DENTAL_LAB_ORDER_SUBMISSION_ENABLED: "true",
    }),
  ).toBe(true);
  await expect(
    assertRetouchReady({ query: async () => ({ rows: [{ ready: false }] }) }),
  ).rejects.toThrow("RETOUCH_STORAGE_NOT_READY");
  const transport = vi.fn(async () => ({
    status: 200,
    json: async () => ({ kind: "submitted" }),
  }));
  await expect(
    createRetouchClient(transport).submit(
      command,
      new globalThis.AbortController().signal,
    ),
  ).rejects.toThrow();
  expect(transport).toHaveBeenCalledTimes(1);
});

test("retouch attaches new verified files to child, scopes upload to source, rolls back on link failure", async () => {
  const policy = {
    storagePolicyVersion: "test",
    capacityPolicyVersion: "test",
  };
  const files = [
    {
      id,
      clinic_id: id,
      created_by: id,
      state: "ready",
      size_bytes: "3",
      content_sha256: Buffer.alloc(32),
      verified_at: new Date(),
      media_type_verified: "model/stl",
      storage_policy_version: "test",
    },
  ];
  const uploads = [
    { id, file_id: id, revision: "1", declared_size: "3", received_bytes: "3" },
  ];
  const cmd = { ...command, input: { ...input, file_ids: [id] } };
  const db = fixture({ files, uploads });
  const r = await createRetouchService(db, policy).submit(actor, cmd);
  expect(r.result.kind).toBe("submitted");
  const binding = db.state.writes.find(([s]) =>
    s.startsWith("INSERT INTO public.order_version_files"),
  );
  expect(binding[1][1]).toBe(r.result.order_id);
  expect(binding[1][1]).not.toBe(input.source_order_id);
  expect(
    db.calls.find(([s]) => s.includes("FROM public.upload_sessions"))[1][3],
  ).toBe(input.source_order_id);
  const failing = fixture({ files, uploads, failAt: "public.work_links(" });
  await expect(
    createRetouchService(failing, policy).submit(actor, cmd),
  ).rejects.toThrow("SYNTHETIC_FAILURE");
  expect(failing.state.writes).toEqual([]);
  expect(failing.state.sourceStatus).toBe("delivered");
});
