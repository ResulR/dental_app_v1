import { test, expect, vi } from "vitest";
import {
  createCancellationRequestService,
  assertCancellationRequestReady,
} from "../../apps/api/dist/modules/orders/index.js";
import { orderRequestEnabled } from "../../apps/api/dist/app/order-request-config.js";
const id = "91000000-0000-4000-8000-000000000001",
  other = "91000000-0000-4000-8000-000000000002",
  actor = { accountId: id, sessionId: id };
const command = {
  order_id: id,
  expected_version_id: id,
  expected_revision: 1,
  action: "request_cancellation",
  confirmed: true,
};
function fixture(patch = {}) {
  const state = {
      status: patch.status ?? "accepted",
      revision: 1,
      writes: [],
      pending: patch.pending
        ? {
            id: other,
            kind: patch.kind ?? "cancellation",
            base_version_id: id,
            revision: "1",
          }
        : null,
    },
    calls = [];
  let queue = Promise.resolve();
  const transaction = vi.fn((fn) => {
    const task = queue.then(async () => {
      const draft = { ...state, writes: [...state.writes] };
      const query = async (sql, values = []) => {
        calls.push([sql, values]);
        if (sql.startsWith("SELECT a.profile"))
          return {
            rows: patch.revoked
              ? []
              : [
                  {
                    profile: patch.profile ?? "clinic",
                    lifecycle: "active",
                    sessionValid: true,
                    securityLocked: false,
                    resetRequired: false,
                    ownerCurrent: patch.ownerCurrent ?? true,
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
          return { rows: patch.unapproved ? [] : [{ id }] };
        if (sql.startsWith("SELECT id AS order_id"))
          return {
            rows: patch.foreign
              ? []
              : [
                  {
                    order_id: id,
                    number: "1",
                    status: draft.status,
                    version_id: id,
                    revision: String(draft.revision),
                  },
                ],
          };
        if (sql.includes("FROM public.work_links"))
          return { rows: patch.retouch ? [{ id }] : [] };
        if (sql.startsWith("SELECT to_jsonb(l)"))
          return {
            rows: patch.noLogistics
              ? []
              : [{ values: { delivery_mode: null } }],
          };
        if (sql.startsWith("SELECT o.current_version_id"))
          return {
            rows: [
              {
                current_version_id: id,
                material_snapshot_id: id,
                shade_snapshot_id: other,
                work_type_snapshot_id: null,
              },
            ],
          };
        if (sql.startsWith("SELECT id,reference_id"))
          return {
            rows: [
              { id, reference_id: patch.missing ? null : id },
              { id: other, reference_id: other },
            ],
          };
        if (sql.startsWith("SELECT id,clinic_id,status")) {
          if (patch.foreign) return { rows: [] };
          return {
            rows: [
              {
                id,
                clinic_id: id,
                status: draft.status,
                current_version_id: patch.changedVersion ? other : id,
                revision: String(draft.revision),
                manufacturing_version_id: patch.unpinned ? other : id,
              },
            ],
          };
        }
        if (sql.startsWith("SELECT id,effective_use_state"))
          return {
            rows: [
              { id, state: patch.catalogState ?? "available" },
              { id: other, state: "available" },
            ],
          };
        if (sql.includes("FROM public.order_security_blocks"))
          return { rows: patch.block ? [{ id }] : [] };
        if (sql.includes("FROM public.order_version_files"))
          return { rows: patch.files ? [{ file_id: id }] : [] };
        if (sql.includes("FROM public.order_requests"))
          return {
            rows: draft.pending
              ? [
                  sql.startsWith("SELECT id,kind,revision")
                    ? {
                        id: draft.pending.id,
                        kind: draft.pending.kind,
                        revision: draft.pending.revision,
                      }
                    : draft.pending,
                ]
              : [],
          };
        if (/^(UPDATE|INSERT|WITH stamp)/.test(sql)) {
          if (patch.failAt && sql.includes(patch.failAt))
            throw new Error("SYNTHETIC_FAILURE");
          draft.writes.push([sql, values]);
          if (sql.startsWith("INSERT INTO public.order_requests")) {
            draft.pending = {
              id: values[0],
              kind: "cancellation",
              base_version_id: id,
              revision: "1",
            };
            return { rows: [] };
          }
          if (sql.startsWith("UPDATE public.order_requests")) {
            draft.pending = null;
            return { rows: patch.requestConflict ? [] : [{ id: other }] };
          }
          if (sql.includes("UPDATE public.order_logistics"))
            return { rows: [{ values: { delivery_mode: "clinic_pickup" } }] };
          if (sql.startsWith("UPDATE public.conversations"))
            return { rows: patch.noConversation ? [] : [{ id }] };
          if (sql.startsWith("UPDATE public.orders")) {
            if (patch.activeRetouch)
              throw Object.assign(new Error("Synthetic unique violation"), {
                code: "23505",
                constraint: "work_links_one_active_retouch_idx",
              });
            draft.status = values[1];
            draft.revision++;
            return { rows: patch.updateConflict ? [] : [{ id }] };
          }
        }
        return { rows: [] };
      };
      const result = await fn({ query });
      Object.assign(state, draft);
      return result;
    });
    queue = task.catch(() => {});
    return task;
  });
  return { transaction, state, calls };
}

const decision = (action) => ({
  ...command,
  action,
  request_id: other,
  expected_request_revision: 1,
  ...(action === "withdraw" ? {} : { reason: "Synthetic decision" }),
});
test("clinic creates one pending request without cancelling or rewriting instructions, replay is a conflict", async () => {
  const db = fixture(),
    service = createCancellationRequestService(db);
  expect((await service.decide(actor, command)).result.state).toBe("pending");
  expect(db.state.status).toBe("accepted");
  expect(db.state.pending.kind).toBe("cancellation");
  expect((await service.decide(actor, command)).result.kind).toBe("conflict");
  expect(db.state.writes).toHaveLength(5);
  expect(
    db.state.writes.some(
      ([sql]) =>
        sql.includes("order_versions") || sql.includes("order_status_events"),
    ),
  ).toBe(false);
});
test("exclusive pending slot includes modification, refuses all wrong statuses and foreign or unapproved clinics", async () => {
  for (const kind of ["cancellation", "modification"]) {
    const db = fixture({ pending: true, kind });
    expect(
      (await createCancellationRequestService(db).decide(actor, command)).result
        .kind,
    ).toBe("pending_request");
    expect(db.state.writes).toEqual([]);
  }
  for (const status of [
    "pending",
    "correction_requested",
    "manufacturing",
    "completed",
    "delivered",
    "cancelled",
    "rejected",
  ]) {
    const db = fixture({ status });
    expect(
      (await createCancellationRequestService(db).decide(actor, command)).result
        .kind,
    ).toBe("conflict");
    expect(db.state.writes).toEqual([]);
  }
  for (const patch of [
    { foreign: true },
    { unapproved: true },
    { profile: "owner" },
    { revoked: true },
  ]) {
    const db = fixture(patch);
    expect(
      (await createCancellationRequestService(db).decide(actor, command)).kind,
    ).toBe("denied");
    expect(db.state.writes).toEqual([]);
  }
});
test("withdrawal requires confirmation current order and request revisions, supports both request kinds", async () => {
  for (const kind of ["cancellation", "modification"]) {
    const db = fixture({ pending: true, kind });
    expect(
      (
        await createCancellationRequestService(db).decide(
          actor,
          decision("withdraw"),
        )
      ).result.state,
    ).toBe("withdrawn");
    expect(db.state.pending).toBe(null);
    expect(db.state.status).toBe("accepted");
  }
  for (const extra of [
    { expected_request_revision: 2 },
    { expected_revision: 2 },
    { expected_version_id: other },
    { request_id: id },
  ]) {
    const db = fixture({ pending: true });
    expect(
      (
        await createCancellationRequestService(db).decide(actor, {
          ...decision("withdraw"),
          ...extra,
        })
      ).result.kind,
    ).toBe("conflict");
    expect(db.state.writes).toEqual([]);
  }
  const db = fixture({ pending: true });
  expect(
    (
      await createCancellationRequestService(db).decide(actor, {
        ...decision("withdraw"),
        confirmed: false,
      })
    ).kind,
  ).toBe("invalid");
});
test("laboratory decision requires cancel permission and can never accept a modification as cancellation", async () => {
  for (const patch of [
    { profile: "clinic" },
    { profile: "employee" },
    { profile: "employee", grants: ["orders.cancel"] },
    { profile: "owner", ownerCurrent: false },
  ]) {
    const db = fixture({ pending: true, ...patch });
    expect(
      (
        await createCancellationRequestService(db).decide(
          actor,
          decision("accept_cancellation"),
        )
      ).kind,
    ).toBe("denied");
    expect(db.state.writes).toEqual([]);
  }
  const db = fixture({ profile: "owner", pending: true, kind: "modification" });
  expect(
    (
      await createCancellationRequestService(db).decide(
        actor,
        decision("accept_cancellation"),
      )
    ).result.kind,
  ).toBe("conflict");
  expect(db.state.writes).toEqual([]);
  for (const action of ["accept_cancellation", "reject_cancellation"]) {
    const db = fixture({
      profile: "employee",
      grants: ["orders.read_logistics", "orders.cancel"],
      pending: true,
    });
    const cmd = decision(action);
    if (action === "reject_cancellation") delete cmd.confirmed;
    expect(
      (await createCancellationRequestService(db).decide(actor, cmd)).result
        .state,
    ).toBe(action === "accept_cancellation" ? "accepted" : "rejected");
    expect(db.state.status).toBe(
      action === "accept_cancellation" ? "cancelled" : "accepted",
    );
    expect(
      db.state.writes.filter(([sql]) => sql.includes("outbox_events")),
    ).toHaveLength(1);
  }
});
test("concurrent requests have one winner in double, request context stays scoped and exposes no proposals", async () => {
  const db = fixture(),
    service = createCancellationRequestService(db);
  expect(
    (
      await Promise.all([
        service.decide(actor, command),
        service.decide(actor, command),
      ])
    ).map((r) => r.result.kind),
  ).toEqual(["updated", "conflict"]);
  const view = await service.context(actor, { order_id: id });
  expect(view.result.pending.kind).toBe("cancellation");
  expect(Object.keys(view.result.pending).sort()).toEqual([
    "id",
    "kind",
    "revision",
  ]);
  expect(
    (
      await createCancellationRequestService(
        fixture({ foreign: true }),
      ).context(actor, { order_id: other })
    ).kind,
  ).toBe("denied");
});
test("failures in request aggregate status event outbox dispatch and audit roll back transaction double", async () => {
  for (const failAt of [
    "UPDATE public.order_requests",
    "UPDATE public.orders",
    "public.order_status_events",
    "public.outbox_events",
    "public.outbox_dispatches",
    "public.audit_events",
  ]) {
    const db = fixture({ profile: "owner", pending: true, failAt });
    await expect(
      createCancellationRequestService(db).decide(
        actor,
        decision("accept_cancellation"),
      ),
    ).rejects.toThrow("SYNTHETIC_FAILURE");
    expect(db.state.pending).not.toBe(null);
    expect(db.state.status).toBe("accepted");
    expect(db.state.writes).toEqual([]);
  }
  expect(orderRequestEnabled({})).toBe(false);
  expect(() =>
    orderRequestEnabled({ DENTAL_LAB_ORDER_REQUEST_ENABLED: "true" }),
  ).toThrow();
  await expect(
    assertCancellationRequestReady({
      query: async () => ({ rows: [{ ready: false }] }),
    }),
  ).rejects.toThrow();
});
test("pending request blocks manufacturing under existing decision service", async () => {
  const { createOrderDecisionService } =
    await import("../../apps/api/dist/modules/orders/index.js");
  const db = fixture({ profile: "owner", pending: true });
  expect(
    (
      await createOrderDecisionService(db).decide(actor, {
        order_id: id,
        expected_version_id: id,
        expected_revision: 1,
        action: "start_manufacturing",
      })
    ).result,
  ).toEqual({ kind: "blocked", reason: "pending_request" });
  expect(db.state.writes).toEqual([]);
});
