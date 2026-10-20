import { test, expect } from "vitest";
import { createDeliveryPlanService } from "../../apps/api/dist/modules/orders/index.js";
import { deliveryPlanEnabled } from "../../apps/api/dist/app/delivery-plan-config.js";
const id = "91000000-0000-4000-8000-000000000001";
const actor = { accountId: id, sessionId: id };
const command = {
  order_id: id,
  expected_version_id: id,
  expected_order_revision: 1,
  expected_logistics_revision: 1,
  planned_delivery_date: "2026-11-10",
};
function fixture(patch = {}) {
  const state = {
    orderRevision: 1,
    logisticsRevision: 1,
    date: null,
    writes: [],
  };
  const calls = [];
  let queue = Promise.resolve();
  const transaction = (work) => {
    const task = queue.then(async () => {
      const copy = { ...state, writes: [...state.writes] };
      const query = async (sql, values = []) => {
        calls.push([sql, values]);
        if (sql.startsWith("SELECT a.profile"))
          return {
            rows: patch.revoked
              ? []
              : [
                  {
                    profile: patch.profile ?? "employee",
                    lifecycle: "active",
                    securityLocked: false,
                    resetRequired: false,
                    sessionValid: true,
                    ownerCurrent: true,
                    clinicId: null,
                    clinicSuspended: false,
                    grants: patch.grants ?? [
                      "orders.read_logistics",
                      "delivery.plan",
                    ],
                  },
                ],
          };
        if (sql.startsWith("SELECT id,clinic_id,status,current_version_id"))
          return {
            rows: patch.foreign
              ? []
              : [
                  {
                    id,
                    clinic_id: id,
                    status: patch.status ?? "accepted",
                    current_version_id: id,
                    revision: String(copy.orderRevision),
                  },
                ],
          };
        if (sql.startsWith("SELECT to_jsonb(l) AS values,revision::text"))
          return {
            rows: [
              {
                values: {
                  planned_delivery_date: copy.date,
                  revision: copy.logisticsRevision,
                },
                revision: String(copy.logisticsRevision),
                planned_delivery_date: copy.date,
              },
            ],
          };
        if (sql.startsWith("UPDATE public.orders SET revision")) {
          if (patch.failOrder) return { rows: [] };
          copy.orderRevision++;
          copy.writes.push(sql);
          return { rows: [{ revision: String(copy.orderRevision) }] };
        }
        if (sql.startsWith("UPDATE public.order_logistics")) {
          if (patch.failLogistics) return { rows: [] };
          copy.logisticsRevision++;
          copy.date = values[2];
          copy.writes.push(sql);
          return {
            rows: [
              {
                values: {
                  planned_delivery_date: copy.date,
                  revision: copy.logisticsRevision,
                },
                revision: String(copy.logisticsRevision),
              },
            ],
          };
        }
        if (sql.startsWith("INSERT")) {
          if (patch.failAt && sql.includes(patch.failAt))
            throw Error("SYNTHETIC_FAILURE");
          copy.writes.push(sql);
        }
        if (sql.startsWith("SELECT o.id AS order_id"))
          return {
            rows: [
              {
                order_id: id,
                version_id: id,
                status: "accepted",
                order_revision: String(copy.orderRevision),
                logistics_revision: String(copy.logisticsRevision),
                requested_delivery_date: "2026-11-12",
                planned_delivery_date: copy.date,
              },
            ],
          };
        if (
          sql.includes("FROM public.order_logistics_events") &&
          sql.startsWith("SELECT id")
        )
          return { rows: [] };
        return { rows: [] };
      };
      const result = await work({ query });
      Object.assign(state, copy);
      return result;
    });
    queue = task.catch(() => {});
    return task;
  };
  return { state, calls, transaction };
}
test("planning date is versioned with event/outbox/audit in one synthetic transaction", async () => {
  const db = fixture(),
    service = createDeliveryPlanService(db);
  expect((await service.context(actor, { order_id: id })).result).toMatchObject(
    {
      order_revision: 1,
      logistics_revision: 1,
      requested_delivery_date: "2026-11-12",
      more_history: false,
    },
  );
  expect((await service.update(actor, command)).result).toEqual({
    kind: "updated",
    planned_delivery_date: "2026-11-10",
    logistics_revision: 2,
  });
  expect(db.state).toMatchObject({
    orderRevision: 2,
    logisticsRevision: 2,
    date: "2026-11-10",
  });
  expect(db.state.writes.join("\n")).toContain("ARRAY['delivery_date']");
  for (const table of [
    "order_logistics_events",
    "outbox_events",
    "outbox_dispatches",
    "audit_events",
  ])
    expect(db.state.writes.join("\n")).toContain("INSERT INTO public." + table);
  expect((await service.update(actor, command)).result.kind).toBe("conflict");
  expect(
    (
      await service.update(actor, {
        ...command,
        expected_order_revision: 2,
        expected_logistics_revision: 2,
      })
    ).result.kind,
  ).toBe("unchanged");
});
test("permissions, closed state, stale revision, no-op and invalid requests refuse writes", async () => {
  for (const patch of [
    { revoked: true },
    { profile: "clinic" },
    { grants: ["orders.read_logistics"] },
    { foreign: true },
  ]) {
    const db = fixture(patch);
    expect(
      (await createDeliveryPlanService(db).update(actor, command)).kind,
    ).toBe("denied");
    expect(db.state.writes).toEqual([]);
  }
  for (const status of ["delivered", "cancelled", "rejected"]) {
    const db = fixture({ status });
    expect(
      (await createDeliveryPlanService(db).update(actor, command)).result.kind,
    ).toBe("closed");
    expect(db.state.writes).toEqual([]);
  }
  const db = fixture();
  expect(
    (
      await createDeliveryPlanService(db).update(actor, {
        ...command,
        expected_logistics_revision: 2,
      })
    ).result.kind,
  ).toBe("conflict");
  expect(
    (
      await createDeliveryPlanService(db).update(actor, {
        ...command,
        planned_delivery_date: null,
      })
    ).result.kind,
  ).toBe("unchanged");
  expect(
    (
      await createDeliveryPlanService(db).update(actor, {
        ...command,
        planned_delivery_date: "bad",
      })
    ).kind,
  ).toBe("invalid");
  expect(db.state.writes).toEqual([]);
});
test("concurrent updates and failures at each write roll back all aggregate changes in double", async () => {
  const db = fixture(),
    service = createDeliveryPlanService(db);
  const both = await Promise.all([
    service.update(actor, command),
    service.update(actor, command),
  ]);
  expect(both.map((r) => r.result.kind)).toEqual(["updated", "conflict"]);
  for (const patch of [
    { failOrder: true },
    { failLogistics: true },
    { failAt: "public.order_logistics_events(" },
    { failAt: "public.outbox_events(" },
    { failAt: "public.outbox_dispatches(" },
    { failAt: "public.audit_events(" },
  ]) {
    const failing = fixture(patch);
    await expect(
      createDeliveryPlanService(failing).update(actor, command),
    ).rejects.toThrow();
    expect(failing.state).toMatchObject({
      orderRevision: 1,
      logisticsRevision: 1,
      date: null,
      writes: [],
    });
  }
});
test("flag is off by default and requires tracking", () => {
  expect(deliveryPlanEnabled({})).toBe(false);
  expect(
    deliveryPlanEnabled({ DENTAL_LAB_DELIVERY_PLAN_ENABLED: "false" }),
  ).toBe(false);
  expect(() =>
    deliveryPlanEnabled({ DENTAL_LAB_DELIVERY_PLAN_ENABLED: "true" }),
  ).toThrow();
  expect(
    deliveryPlanEnabled({
      DENTAL_LAB_DELIVERY_PLAN_ENABLED: "true",
      DENTAL_LAB_ORDER_TRACKING_ENABLED: "true",
    }),
  ).toBe(true);
});
