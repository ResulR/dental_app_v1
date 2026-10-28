import { test, expect, vi } from "vitest";
import { createOrderModificationService } from "../../apps/api/dist/modules/orders/index.js";
import { createOrderModificationClient } from "../../apps/web/src/features/orders/modification-api.ts";
import { orderModificationEnabled } from "../../apps/api/dist/app/order-modification-config.js";
const id = "92000000-0000-4000-8000-000000000001",
  proposed = "92000000-0000-4000-8000-000000000002",
  shade = "92000000-0000-4000-8000-000000000003";
const actor = { accountId: id, sessionId: id },
  command = {
    order_id: id,
    expected_version_id: id,
    expected_revision: 2,
    request_id: id,
    expected_request_revision: 1,
    action: "accept_modification",
    confirmed_warnings: false,
  };
function fixture(patch = {}) {
  const state = { version: id, revision: 2, pending: true, writes: [] },
    calls = [];
  let queue = Promise.resolve();
  const transaction = vi.fn((fn) => {
    const task = queue.then(async () => {
      const draft = { ...state, writes: [...state.writes] };
      const query = async (sql, v = []) => {
        calls.push([sql, v]);
        if (sql.startsWith("SELECT a.profile"))
          return {
            rows: patch.revoked
              ? []
              : [
                  {
                    profile:
                      patch.profile ?? (v[0] === shade ? "clinic" : "owner"),
                    lifecycle: "active",
                    sessionValid: true,
                    securityLocked: false,
                    resetRequired: false,
                    ownerCurrent: true,
                    clinicId: id,
                    clinicSuspended: false,
                    grants: patch.grants ?? [],
                  },
                ],
          };
        if (
          sql.startsWith(
            "SELECT id FROM public.clinics WHERE account_id=$1 AND",
          )
        )
          return { rows: [{ id }] };
        if (sql.startsWith("SELECT id,number::text"))
          return {
            rows: patch.foreign
              ? []
              : [
                  {
                    id,
                    number: "10",
                    kind: "retouch",
                    origin: "clinic",
                    status: "accepted",
                    current_version_id: draft.version,
                    revision: String(draft.revision),
                  },
                ],
          };
        if (sql.startsWith("SELECT id FROM public.orders WHERE id=$1"))
          return { rows: patch.foreign ? [] : [{ id }] };
        if (sql.startsWith("SELECT id,state,requested_at"))
          return {
            rows: patch.foreign
              ? []
              : [
                  {
                    id,
                    state: draft.pending ? "pending" : "rejected",
                    requested_at: new Date("2026-10-19T12:00:00.000Z"),
                    decided_at: draft.pending
                      ? null
                      : new Date("2026-10-19T13:00:00.000Z"),
                    decision_reason: draft.pending ? null : "Synthetic refusal",
                    base_version_id: id,
                    proposed_version_id: proposed,
                  },
                ],
          };
        if (
          sql.startsWith(
            "SELECT id,base_version_id,proposed_version_id,revision::text,state",
          )
        )
          return {
            rows:
              draft.pending || v[1]
                ? [
                    {
                      id,
                      base_version_id: id,
                      proposed_version_id: proposed,
                      revision: draft.pending ? "1" : "2",
                      state: draft.pending ? "pending" : "rejected",
                      decision_reason: draft.pending
                        ? null
                        : "Synthetic refusal",
                    },
                  ]
                : [],
          };
        if (sql.startsWith("SELECT id,proposed_version_id"))
          return {
            rows: draft.pending
              ? [{ id, proposed_version_id: proposed, revision: "1" }]
              : [],
          };
        if (sql.startsWith("SELECT id,version_number"))
          return {
            rows: [
              {
                id,
                version_number: "1",
                created_at: "2026-10-19T12:00:00.000Z",
                created_by: id,
                reason: null,
              },
            ],
          };
        if (sql.startsWith("SELECT proposed_version_id"))
          return {
            rows: draft.pending ? [{ proposed_version_id: proposed }] : [],
          };
        if (sql.startsWith("SELECT v.id,"))
          return {
            rows: [
              {
                id: v[1],
                material: "Historical material",
                shade: "Historical shade",
                work_type: null,
                material_id: id,
                shade_id: shade,
                patient: { internal_reference: "Synthetic" },
                requested_delivery_date: null,
                description: "Synthetic problem",
                teeth: [],
                file_count: patch.files ? 1 : 0,
              },
            ],
          };
        if (sql.startsWith("SELECT id,kind,label"))
          return {
            rows: [
              {
                id,
                kind: "material",
                label: "Synthetic",
                revision: "1",
                state: patch.catalogState ?? "available",
              },
              {
                id: shade,
                kind: "shade",
                label: "Synthetic",
                revision: "1",
                state: "available",
              },
            ],
          };
        if (sql.startsWith("SELECT id,clinic_id,status"))
          return {
            rows: [
              {
                id,
                clinic_id: id,
                status: patch.status ?? "accepted",
                current_version_id: draft.version,
                revision: String(draft.revision),
                manufacturing_version_id: patch.pinned ? id : null,
              },
            ],
          };
        if (
          sql.startsWith("SELECT id,base_version_id") ||
          sql.startsWith("SELECT id,kind,base_version_id")
        )
          return {
            rows: draft.pending
              ? [
                  {
                    id,
                    kind: "modification",
                    base_version_id: patch.changedBase ? proposed : id,
                    proposed_version_id: proposed,
                    revision: patch.changedRequest ? "2" : "1",
                  },
                ]
              : [],
          };
        if (sql.includes("FROM public.order_security_blocks"))
          return { rows: patch.block ? [{ id }] : [] };
        if (/^(INSERT|UPDATE)/.test(sql)) {
          if (patch.failAt && sql.includes(patch.failAt))
            throw new Error("SYNTHETIC_FAILURE");
          draft.writes.push([sql, v]);
          if (sql.startsWith("UPDATE public.order_requests"))
            draft.pending = false;
          if (sql.startsWith("UPDATE public.orders")) {
            if (sql.includes("SET current_version_id")) draft.version = v[1];
            draft.revision++;
          }
          return { rows: [{ id }] };
        }
        return { rows: [] };
      };
      const r = await fn({ query });
      Object.assign(state, draft);
      return r;
    });
    queue = task.catch(() => {});
    return task;
  });
  return { state, calls, transaction };
}
test("accepts only the pending proposed version atomically, keeps accepted status and emits one decision", async () => {
  const db = fixture(),
    r = await createOrderModificationService(db).decide(actor, command);
  expect(r.result).toMatchObject({
    kind: "updated",
    version_id: proposed,
    status: "accepted",
    revision: 3,
  });
  expect(db.state.version).toBe(proposed);
  expect(db.state.pending).toBe(false);
  expect(
    db.state.writes.filter(([s]) =>
      s.includes("INSERT INTO public.outbox_events"),
    ),
  ).toHaveLength(1);
  expect(
    db.state.writes.some(
      ([s]) =>
        s.includes("UPDATE public.order_versions") || s.includes("DELETE"),
    ),
  ).toBe(false);
  expect(
    db.calls.findIndex(([s]) => s.includes("ORDER BY id FOR SHARE")),
  ).toBeLessThan(
    db.calls.findIndex(
      ([s]) => s.includes("FROM public.orders") && s.endsWith("FOR UPDATE"),
    ),
  );
});
test("reject requires a reason, retains original and can reject an invalid/forbidden proposal", async () => {
  const db = fixture({ catalogState: "forbidden", files: true, block: true });
  const repo = createOrderModificationService(db);
  const reject = {
    ...command,
    action: "reject_modification",
    reason: "Not suitable",
  };
  delete reject.confirmed_warnings;
  expect((await repo.decide(actor, { ...reject, reason: " " })).kind).toBe(
    "invalid",
  );
  expect((await repo.decide(actor, reject)).result.kind).toBe("updated");
  expect(db.state.version).toBe(id);
  expect(db.state.writes[0][1][1]).toBe("rejected");
  expect(db.state.writes[0][1][3]).toBe("Not suitable");
  expect(db.calls.some(([s]) => s.startsWith("SELECT v.id,"))).toBe(false);
});
test("current permissions, status, aggregate and request CAS prevent stale or unauthorized decisions", async () => {
  for (const patch of [
    { revoked: true },
    { profile: "clinic" },
    { profile: "employee" },
    { status: "manufacturing" },
    { pinned: true },
    { changedBase: true },
    { changedRequest: true },
  ]) {
    const db = fixture(patch);
    await createOrderModificationService(db).decide(actor, command);
    expect(db.state.writes).toEqual([]);
  }
  const db = fixture();
  expect(
    (
      await createOrderModificationService(db).decide(actor, {
        ...command,
        expected_revision: 1,
      })
    ).result.kind,
  ).toBe("conflict");
  expect(db.state.writes).toEqual([]);
});
test("acceptance revalidates forbidden/unavailable catalog, file and security guards", async () => {
  for (const [patch, reason] of [
    [{ catalogState: "forbidden" }, "catalog_forbidden"],
    [{ files: true }, "files_not_ready"],
    [{ block: true }, "security_block"],
  ]) {
    const db = fixture(patch);
    expect(
      (await createOrderModificationService(db).decide(actor, command)).result,
    ).toEqual({ kind: "blocked", reason });
    expect(db.state.writes).toEqual([]);
  }
  const db = fixture({ catalogState: "unavailable" }),
    repo = createOrderModificationService(db);
  expect((await repo.decide(actor, command)).result.kind).toBe(
    "confirmation_required",
  );
  expect(db.state.writes).toEqual([]);
  expect(
    (await repo.decide(actor, { ...command, confirmed_warnings: true })).result
      .kind,
  ).toBe("updated");
});
test("transaction double rolls back each write failure; competing accept/reject has one winner", async () => {
  for (const failAt of [
    "UPDATE public.order_requests",
    "UPDATE public.orders",
    "INSERT INTO public.outbox_events",
    "INSERT INTO public.outbox_dispatches",
    "INSERT INTO public.audit_events",
  ]) {
    const db = fixture({ failAt });
    await expect(
      createOrderModificationService(db).decide(actor, command),
    ).rejects.toThrow("SYNTHETIC_FAILURE");
    expect(db.state).toEqual({
      version: id,
      revision: 2,
      pending: true,
      writes: [],
    });
  }
  const db = fixture(),
    repo = createOrderModificationService(db);
  const reject = {
    ...command,
    action: "reject_modification",
    reason: "Synthetic",
  };
  delete reject.confirmed_warnings;
  const pair = await Promise.all([
    repo.decide(actor, command),
    repo.decide(actor, reject),
  ]);
  expect(pair.map((r) => r.result.kind).sort()).toEqual([
    "conflict",
    "updated",
  ]);
  expect(
    db.state.writes.filter(([s]) => s.startsWith("UPDATE public.orders")),
  ).toHaveLength(1);
});
test("new feature stays off without explicit dependencies; HTTP client rejects malformed success without retry", async () => {
  expect(orderModificationEnabled({})).toBe(false);
  expect(() =>
    orderModificationEnabled({ DENTAL_LAB_ORDER_MODIFICATION_ENABLED: "true" }),
  ).toThrow();
  expect(
    orderModificationEnabled({
      DENTAL_LAB_ORDER_MODIFICATION_ENABLED: "true",
      DENTAL_LAB_ORDER_EDIT_ENABLED: "true",
      DENTAL_LAB_ORDER_REQUEST_ENABLED: "true",
    }),
  ).toBe(true);
  const transport = vi.fn(async () => ({
    status: 200,
    json: async () => ({ kind: "updated" }),
  }));
  await expect(
    createOrderModificationClient(transport).decide(
      command,
      new globalThis.AbortController().signal,
    ),
  ).rejects.toThrow();
  expect(transport).toHaveBeenCalledTimes(1);
});

test("pending review exposes two scoped immutable versions in one transaction", async () => {
  const db = fixture(),
    r = await createOrderModificationService(db).context(actor, {
      order_id: id,
    });
  expect(r.kind).toBe("result");
  expect(r.result.base.version_id).toBe(id);
  expect(r.result.proposal.version_id).toBe(proposed);
  expect(r.result.proposal.current_version_id).toBe(id);
  expect(r.result.state).toBe("pending");
  expect(db.transaction).toHaveBeenCalledTimes(1);
  expect(db.state.writes).toEqual([]);
  const foreign = fixture({ foreign: true });
  expect(
    (
      await createOrderModificationService(foreign).context(
        { accountId: shade, sessionId: shade },
        { order_id: id },
      )
    ).kind,
  ).toBe("denied");
  expect(foreign.calls.some(([s]) => s.startsWith("SELECT v.id,"))).toBe(false);
});
test("clinical withdrawal and laboratory decision serialize against the same request", async () => {
  const { createCancellationRequestService } =
    await import("../../apps/api/dist/modules/orders/index.js");
  for (const withdrawFirst of [true, false]) {
    const db = fixture(),
      lab = createOrderModificationService(db),
      clinic = createCancellationRequestService(db);
    const withdraw = () =>
      clinic.decide(
        { accountId: shade, sessionId: shade },
        {
          order_id: id,
          expected_version_id: id,
          expected_revision: 2,
          request_id: id,
          expected_request_revision: 1,
          action: "withdraw",
          confirmed: true,
        },
      );
    const accept = () => lab.decide(actor, command);
    const pair = await Promise.all(
      withdrawFirst ? [withdraw(), accept()] : [accept(), withdraw()],
    );
    expect(pair.map((r) => r.result.kind).sort()).toEqual([
      "conflict",
      "updated",
    ]);
    expect(db.state.version).toBe(withdrawFirst ? id : proposed);
    expect(db.state.pending).toBe(false);
  }
});

test("decided modification remains comparable by authorized clinic, foreign scope fails before request read", async () => {
  const db = fixture();
  const reject = {
    ...command,
    action: "reject_modification",
    reason: "Synthetic refusal",
  };
  delete reject.confirmed_warnings;
  expect(
    (await createOrderModificationService(db).decide(actor, reject)).result
      .kind,
  ).toBe("updated");
  const repo = createOrderModificationService(db);
  const history = await repo.history(
    { accountId: shade, sessionId: shade },
    { order_id: id },
  );
  expect(history.result.items[0]).toMatchObject({
    state: "rejected",
    decision_reason: "Synthetic refusal",
  });
  const comparison = await repo.context(
    { accountId: shade, sessionId: shade },
    { order_id: id, request_id: id },
  );
  expect({ comparison, tail: db.calls.slice(-25) }).toMatchObject({
    comparison: { kind: "result" },
  });
  expect(comparison.result).toMatchObject({
    state: "rejected",
    decision_reason: "Synthetic refusal",
    base: { version_id: id },
    proposal: { version_id: proposed },
  });
  const foreign = fixture({ foreign: true });
  expect(
    (
      await createOrderModificationService(foreign).history(
        { accountId: shade, sessionId: shade },
        { order_id: id },
      )
    ).kind,
  ).toBe("denied");
  expect(
    foreign.calls.some(([sql]) =>
      sql.startsWith("SELECT id,state,requested_at"),
    ),
  ).toBe(false);
});
