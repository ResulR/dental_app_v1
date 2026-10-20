import { test, expect } from "vitest";
import { createDeliveryPriorityService } from "../../apps/api/dist/modules/orders/index.js";
import { deliveryPriorityEnabled } from "../../apps/api/dist/app/delivery-priority-config.js";
const id = "91000000-0000-4000-8000-000000000001",
  actor = { accountId: id, sessionId: id };
const command = {
  order_id: id,
  expected_version_id: id,
  expected_order_revision: 1,
  expected_logistics_revision: 1,
  priority: true,
};
// Transactional double only; PostgreSQL constraints and locks remain untested.
function fixture(patch = {}) {
  const state = {
    orderRevision: 1,
    logisticsRevision: 1,
    priority: false,
    writes: [],
  };
  let queue = Promise.resolve();
  return {
    state,
    transaction: (work) => {
      const task = queue.then(async () => {
        const next = { ...state, writes: [...state.writes] };
        const query = async (sql, values = []) => {
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
                        "delivery.set_priority",
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
                      revision: String(next.orderRevision),
                    },
                  ],
            };
          if (sql.startsWith("SELECT to_jsonb(l) AS values,revision::text"))
            return {
              rows: [
                {
                  values: {
                    priority: next.priority,
                    revision: next.logisticsRevision,
                  },
                  revision: String(next.logisticsRevision),
                  priority: next.priority,
                },
              ],
            };
          if (sql.startsWith("UPDATE public.orders SET revision")) {
            next.orderRevision++;
            next.writes.push(sql);
            return { rows: [{ revision: String(next.orderRevision) }] };
          }
          if (sql.startsWith("UPDATE public.order_logistics")) {
            if (patch.failUpdate) return { rows: [] };
            next.logisticsRevision++;
            next.priority = values[2];
            next.writes.push(sql);
            return {
              rows: [
                {
                  values: {
                    priority: next.priority,
                    revision: next.logisticsRevision,
                  },
                  revision: String(next.logisticsRevision),
                },
              ],
            };
          }
          if (sql.startsWith("INSERT")) {
            if (patch.failAt && sql.includes(patch.failAt))
              throw Error("SYNTHETIC_FAILURE");
            next.writes.push(sql);
          }
          if (sql.startsWith("SELECT o.id AS order_id"))
            return {
              rows: [
                {
                  order_id: id,
                  version_id: id,
                  status: "accepted",
                  order_revision: String(next.orderRevision),
                  logistics_revision: String(next.logisticsRevision),
                  priority: next.priority,
                },
              ],
            };
          if (sql.startsWith("SELECT id,occurred_at")) return { rows: [] };
          return { rows: [] };
        };
        const result = await work({ query });
        Object.assign(state, next);
        return result;
      });
      queue = task.catch(() => {});
      return task;
    },
  };
}
test("priority updates under versions and records logistics, outbox and audit", async () => {
  const db = fixture(),
    service = createDeliveryPriorityService(db);
  expect((await service.context(actor, { order_id: id })).result).toMatchObject(
    { priority: false, more_history: false },
  );
  expect((await service.update(actor, command)).result).toEqual({
    kind: "updated",
    priority: true,
    logistics_revision: 2,
  });
  expect(db.state).toMatchObject({
    orderRevision: 2,
    logisticsRevision: 2,
    priority: true,
  });
  const writes = db.state.writes.join("\n");
  for (const table of [
    "order_logistics_events",
    "outbox_events",
    "outbox_dispatches",
    "audit_events",
  ])
    expect(writes).toContain("INSERT INTO public." + table);
  expect(writes).toContain("ARRAY['priority']");
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
test("clinic, revoked grant, closed status and stale version refuse mutation", async () => {
  for (const patch of [
    { revoked: true },
    { profile: "clinic" },
    { grants: ["orders.read_logistics"] },
    { foreign: true },
  ]) {
    const db = fixture(patch);
    expect(
      (await createDeliveryPriorityService(db).update(actor, command)).kind,
    ).toBe("denied");
    expect(db.state.writes).toEqual([]);
  }
  for (const status of ["delivered", "rejected", "cancelled"]) {
    const db = fixture({ status });
    expect(
      (await createDeliveryPriorityService(db).update(actor, command)).result
        .kind,
    ).toBe("closed");
    expect(db.state.writes).toEqual([]);
  }
  const db = fixture(),
    service = createDeliveryPriorityService(db);
  expect(
    (
      await service.update(actor, {
        ...command,
        expected_logistics_revision: 2,
      })
    ).result.kind,
  ).toBe("conflict");
  expect(
    (await service.update(actor, { ...command, priority: "yes" })).kind,
  ).toBe("invalid");
  expect(db.state.writes).toEqual([]);
});
test("concurrent click and injected failure roll back all writes in double", async () => {
  const db = fixture(),
    service = createDeliveryPriorityService(db);
  expect(
    (
      await Promise.all([
        service.update(actor, command),
        service.update(actor, command),
      ])
    ).map((x) => x.result.kind),
  ).toEqual(["updated", "conflict"]);
  for (const patch of [
    { failUpdate: true },
    { failAt: "public.order_logistics_events(" },
    { failAt: "public.outbox_events(" },
    { failAt: "public.outbox_dispatches(" },
    { failAt: "public.audit_events(" },
  ]) {
    const failing = fixture(patch);
    await expect(
      createDeliveryPriorityService(failing).update(actor, command),
    ).rejects.toThrow();
    expect(failing.state).toMatchObject({
      orderRevision: 1,
      logisticsRevision: 1,
      priority: false,
      writes: [],
    });
  }
});
test("priority feature is disabled unless explicitly enabled with tracking", () => {
  expect(deliveryPriorityEnabled({})).toBe(false);
  expect(() =>
    deliveryPriorityEnabled({ DENTAL_LAB_DELIVERY_PRIORITY_ENABLED: "true" }),
  ).toThrow();
  expect(
    deliveryPriorityEnabled({
      DENTAL_LAB_DELIVERY_PRIORITY_ENABLED: "true",
      DENTAL_LAB_ORDER_TRACKING_ENABLED: "true",
    }),
  ).toBe(true);
});
