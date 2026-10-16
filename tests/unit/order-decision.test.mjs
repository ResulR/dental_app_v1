import { test, expect, vi } from "vitest";
import {
  createOrderDecisionService,
  assertOrderDecisionReady,
} from "../../apps/api/dist/modules/orders/index.js";
import { orderDecisionEnabled } from "../../apps/api/dist/app/order-decision-config.js";
const id = "91000000-0000-4000-8000-000000000001",
  other = "91000000-0000-4000-8000-000000000002",
  actor = { accountId: id, sessionId: id };
const command = {
  order_id: id,
  expected_version_id: id,
  expected_revision: 1,
  action: "accept",
  confirm_unavailable: false,
};
function fixture(patch = {}) {
  const state = { status: patch.status ?? "pending", revision: 1, writes: [] },
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
                    profile: patch.profile ?? "owner",
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
        if (sql.startsWith("SELECT id,clinic_id,status"))
          return {
            rows: [
              {
                id,
                clinic_id: id,
                status: draft.status,
                current_version_id: patch.changedVersion ? other : id,
                revision: String(draft.revision),
              },
            ],
          };
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
          return { rows: patch.pending ? [{ id }] : [] };
        if (/^(UPDATE|INSERT)/.test(sql)) {
          if (patch.failAt && sql.includes(patch.failAt))
            throw new Error("SYNTHETIC_FAILURE");
          draft.writes.push([sql, values]);
          if (sql.startsWith("UPDATE public.orders")) {
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
test("accept current pending version atomically records status event outbox and audit with catalogue locks before order", async () => {
  const db = fixture(),
    result = await createOrderDecisionService(db).decide(actor, command);
  expect(result.result).toEqual({
    kind: "updated",
    order_id: id,
    status: "accepted",
    revision: 2,
    version_id: id,
  });
  expect(db.state.writes).toHaveLength(5);
  expect(
    db.calls.findIndex(([s]) => s.includes("ORDER BY id FOR SHARE")),
  ).toBeLessThan(
    db.calls.findIndex(([s]) =>
      s.includes("FROM public.orders WHERE id=$1 FOR UPDATE"),
    ),
  );
  expect(
    db.state.writes.find(([s]) => s.includes("order_status_events"))[1],
  ).toEqual([id, id, "pending", "accepted", id, null, id, 2]);
  expect(
    db.state.writes.some(
      ([s]) =>
        s.includes("UPDATE public.catalog") ||
        s.includes("UPDATE public.order_versions"),
    ),
  ).toBe(false);
});
test("current permissions and prerequisites enforced before order reads, owner authority is not inferred from profile", async () => {
  for (const patch of [
    { revoked: true },
    { profile: "clinic" },
    { ownerCurrent: false },
    { profile: "admin" },
    { profile: "employee", grants: ["orders.accept"] },
  ]) {
    const db = fixture(patch);
    expect(
      (await createOrderDecisionService(db).decide(actor, command)).kind,
    ).toBe("denied");
    expect(db.state.writes).toEqual([]);
    expect(
      db.calls.some(([s]) => s.includes("SELECT o.current_version_id")),
    ).toBe(false);
  }
  const db = fixture({
    profile: "employee",
    grants: ["orders.read_logistics", "orders.read_details", "orders.accept"],
  });
  expect(
    (await createOrderDecisionService(db).decide(actor, command)).result.kind,
  ).toBe("updated");
});
test("stale version/revision and invalid transitions cannot write; concurrent decisions have one winner in transactional double", async () => {
  for (const [patch, cmd] of [
    [{ changedVersion: true }, command],
    [{}, { ...command, expected_revision: 2 }],
    [{ status: "accepted" }, command],
    [{ status: "manufacturing" }, command],
  ]) {
    const db = fixture(patch);
    expect(
      (await createOrderDecisionService(db).decide(actor, cmd)).result.kind,
    ).toBe("conflict");
    expect(db.state.writes).toEqual([]);
  }
  const db = fixture(),
    service = createOrderDecisionService(db);
  const results = await Promise.all([
    service.decide(actor, command),
    service.decide(actor, {
      order_id: id,
      expected_version_id: id,
      expected_revision: 1,
      action: "reject",
      reason: "Synthetic refusal",
    }),
  ]);
  expect(results.map((r) => r.result.kind)).toEqual(["updated", "conflict"]);
  expect(db.state.writes).toHaveLength(5);
});
test("unavailable acceptance requires confirmation and reason but never reactivates catalogue", async () => {
  for (const extra of [
    {},
    { confirm_unavailable: true },
    { reason: "Synthetic exception" },
  ]) {
    const db = fixture({ catalogState: "unavailable" });
    expect(
      (
        await createOrderDecisionService(db).decide(actor, {
          ...command,
          ...extra,
        })
      ).result.kind,
    ).toBe("exception_required");
    expect(db.state.writes).toEqual([]);
  }
  const db = fixture({ catalogState: "unavailable" });
  expect(
    (
      await createOrderDecisionService(db).decide(actor, {
        ...command,
        confirm_unavailable: true,
        reason: "Synthetic exception",
      })
    ).result.kind,
  ).toBe("updated");
  expect(
    db.state.writes.find(([s]) => s.includes("order_status_events"))[1][5],
  ).toBe("Synthetic exception");
});
test("forbidden references and security blocks cannot be bypassed even by current owner", async () => {
  for (const [patch, reason] of [
    [{ catalogState: "forbidden" }, "catalog_forbidden"],
    [{ block: true }, "security_block"],
    [{ missing: true }, "catalog_missing"],
    [{ files: true }, "files_not_ready"],
  ]) {
    const db = fixture(patch);
    expect(
      (
        await createOrderDecisionService(db).decide(actor, {
          ...command,
          confirm_unavailable: true,
          reason: "No override",
        })
      ).result,
    ).toEqual({ kind: "blocked", reason });
    expect(db.state.writes).toEqual([]);
  }
});
test("refusal requires reason, retains evidence and is possible despite security block", async () => {
  const cmd = {
      order_id: id,
      expected_version_id: id,
      expected_revision: 1,
      action: "reject",
    },
    db = fixture({ block: true, catalogState: "forbidden" });
  expect((await createOrderDecisionService(db).decide(actor, cmd)).kind).toBe(
    "invalid",
  );
  expect(
    (
      await createOrderDecisionService(db).decide(actor, {
        ...cmd,
        reason: "  ",
      })
    ).kind,
  ).toBe("invalid");
  expect(
    (
      await createOrderDecisionService(db).decide(actor, {
        ...cmd,
        reason: "Synthetic refusal",
      })
    ).result.status,
  ).toBe("rejected");
  expect(db.state.writes.some(([s]) => s.startsWith("DELETE"))).toBe(false);
});
test("manufacturing pins current version and rejects pending requests or security interdiction", async () => {
  const cmd = {
    order_id: id,
    expected_version_id: id,
    expected_revision: 1,
    action: "start_manufacturing",
  };
  for (const [patch, reason] of [
    [{ pending: true }, "pending_request"],
    [{ catalogState: "forbidden" }, "catalog_forbidden"],
    [{ block: true }, "security_block"],
  ]) {
    const db = fixture({ status: "accepted", ...patch });
    expect(
      (await createOrderDecisionService(db).decide(actor, cmd)).result,
    ).toEqual({ kind: "blocked", reason });
    expect(db.state.writes).toEqual([]);
  }
  const db = fixture({ status: "accepted" });
  expect(
    (await createOrderDecisionService(db).decide(actor, cmd)).result.status,
  ).toBe("manufacturing");
  expect(db.state.writes[0][0]).toContain(
    "THEN current_version_id ELSE manufacturing_version_id",
  );
});
test("failures at aggregate event outbox and audit roll back transaction double, no automatic retry", async () => {
  for (const failAt of [
    "UPDATE public.orders",
    "public.order_status_events",
    "public.outbox_events",
    "public.outbox_dispatches",
    "public.audit_events",
  ]) {
    const db = fixture({ failAt });
    await expect(
      createOrderDecisionService(db).decide(actor, command),
    ).rejects.toThrow("SYNTHETIC_FAILURE");
    expect(db.state.status).toBe("pending");
    expect(db.state.writes).toEqual([]);
    expect(db.transaction).toHaveBeenCalledTimes(1);
  }
  const db = fixture({ updateConflict: true });
  await expect(
    createOrderDecisionService(db).decide(actor, command),
  ).rejects.toThrow("ORDER_DECISION_WRITE_CONFLICT");
  expect(db.state.writes).toEqual([]);
});
test("decision activation and storage readiness reject missing dependencies", async () => {
  expect(orderDecisionEnabled({})).toBe(false);
  expect(() =>
    orderDecisionEnabled({ DENTAL_LAB_ORDER_DECISION_ENABLED: "true" }),
  ).toThrow();
  await expect(
    assertOrderDecisionReady({
      query: async () => ({ rows: [{ ready: false }] }),
    }),
  ).rejects.toThrow();
});
