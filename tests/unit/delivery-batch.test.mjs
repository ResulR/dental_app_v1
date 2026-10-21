import { test, expect } from "vitest";
import { createDeliveryBatchService } from "../../apps/api/dist/modules/orders/index.js";
import { DeliveryBatchCommandSchema } from "../../packages/contracts/dist/index.js";
const uuid = (n) => "92000000-0000-4000-8000-" + String(n).padStart(12, "0");
const actor = { accountId: uuid(9), sessionId: uuid(10) };
const items = [1, 2].map((n) => ({
  order_id: uuid(n),
  expected_version_id: uuid(n + 10),
  expected_revision: 1,
  mode: "clinic_pickup",
}));
const command = (receipt_id = uuid(99)) => ({
  receipt_id,
  confirmed: true,
  items,
});
function fixture(patch = {}) {
  const state = {
    orders: new Map(
      items.map((i) => [i.order_id, { status: "completed", revision: 1 }]),
    ),
    receipts: new Map(),
    writes: [],
  };
  let queue = Promise.resolve();
  const db = {
    transaction(fn) {
      const task = queue.then(async () => {
        const draft = {
          orders: new Map([...state.orders].map(([k, v]) => [k, { ...v }])),
          receipts: new Map(state.receipts),
          writes: [...state.writes],
        };
        const query = async (sql, values = []) => {
          if (sql.startsWith("SELECT a.profile"))
            return {
              rows: patch.denied
                ? []
                : [
                    {
                      profile: "owner",
                      lifecycle: "active",
                      sessionValid: true,
                      securityLocked: false,
                      resetRequired: false,
                      ownerCurrent: true,
                      clinicId: null,
                      clinicSuspended: false,
                      grants: [],
                    },
                  ],
            };
          if (sql.startsWith("INSERT INTO public.delivery_batch_receipts")) {
            if (draft.receipts.has(values[0])) return { rows: [] };
            draft.receipts.set(values[0], {
              actor_id: values[1],
              payload_hash: values[2],
              result: { kind: "pending" },
            });
            return { rows: [{ id: values[0] }] };
          }
          if (sql.startsWith("SELECT actor_id,payload_hash,result")) {
            const r = draft.receipts.get(values[0]);
            return { rows: r ? [r] : [] };
          }
          if (
            sql.startsWith("SELECT result FROM public.delivery_batch_receipts")
          ) {
            const r = draft.receipts.get(values[0]);
            return { rows: r && r.actor_id === values[1] ? [r] : [] };
          }
          if (sql.startsWith("SELECT o.current_version_id")) {
            const item = items.find((i) => i.order_id === values[0]);
            return {
              rows: item
                ? [
                    {
                      current_version_id: item.expected_version_id,
                      material_snapshot_id: uuid(30),
                      shade_snapshot_id: uuid(31),
                      work_type_snapshot_id: null,
                    },
                  ]
                : [],
            };
          }
          if (sql.startsWith("SELECT id,reference_id"))
            return {
              rows: [
                { id: uuid(30), reference_id: uuid(40) },
                { id: uuid(31), reference_id: uuid(41) },
              ],
            };
          if (sql.startsWith("SELECT id,effective_use_state"))
            return {
              rows: [
                { id: uuid(40), state: "available" },
                { id: uuid(41), state: "available" },
              ],
            };
          if (sql.startsWith("SELECT id,clinic_id,status")) {
            const o = draft.orders.get(values[0]);
            return {
              rows: o
                ? [
                    {
                      id: values[0],
                      clinic_id: uuid(50),
                      status:
                        patch.mixed && values[0] === uuid(2)
                          ? "accepted"
                          : o.status,
                      current_version_id: items.find(
                        (i) => i.order_id === values[0],
                      ).expected_version_id,
                      manufacturing_version_id: items.find(
                        (i) => i.order_id === values[0],
                      ).expected_version_id,
                      revision: String(
                        patch.conflict && values[0] === uuid(2)
                          ? o.revision + 1
                          : o.revision,
                      ),
                    },
                  ]
                : [],
            };
          }
          if (sql.startsWith("SELECT clock_timestamp"))
            return { rows: [{ at: "2026-10-21 10:00:00+00" }] };
          if (sql.startsWith("SELECT to_jsonb(l)"))
            return { rows: [{ values: { delivery_mode: null } }] };
          if (sql.startsWith("UPDATE public.orders")) {
            const o = draft.orders.get(values[0]);
            if (!o || o.revision !== values[1]) return { rows: [] };
            o.status = "delivered";
            o.revision++;
            draft.writes.push(sql);
            return { rows: [{ id: values[0] }] };
          }
          if (sql.startsWith("UPDATE public.order_logistics"))
            return { rows: [{ values: { delivery_mode: values[1] } }] };
          if (sql.startsWith("UPDATE public.conversations"))
            return { rows: [{ id: values[0] }] };
          if (sql.startsWith("UPDATE public.delivery_batch_receipts")) {
            draft.receipts.get(values[0]).result = JSON.parse(values[1]);
            return { rows: [] };
          }
          if (patch.failAt && sql.includes(patch.failAt))
            throw new Error("synthetic failure");
          if (/^(UPDATE|INSERT)/.test(sql)) draft.writes.push(sql);
          return { rows: [] };
        };
        const output = await fn({ query });
        Object.assign(state, draft);
        return output;
      });
      queue = task.catch(() => {});
      return task;
    },
  };
  return { db, state };
}
test("strict confirmation, unique selection and bounded lot", () => {
  expect(
    DeliveryBatchCommandSchema.safeParse({ ...command(), confirmed: false })
      .success,
  ).toBe(false);
  expect(
    DeliveryBatchCommandSchema.safeParse({
      ...command(),
      items: [items[0], items[0]],
    }).success,
  ).toBe(false);
  expect(
    DeliveryBatchCommandSchema.safeParse({ ...command(), items: [items[0]] })
      .success,
  ).toBe(false);
});
test("commits each order and all traces, then returns same receipt on retry", async () => {
  const { db, state } = fixture(),
    service = createDeliveryBatchService(db);
  const first = await service.deliver(actor, command());
  expect(first.result.kind).toBe("delivered");
  expect(first.result.items).toHaveLength(2);
  expect(
    state.writes.filter((s) => s.startsWith("UPDATE public.orders")),
  ).toHaveLength(2);
  expect(state.writes.filter((s) => s.includes("outbox_events"))).toHaveLength(
    2,
  );
  expect(state.writes.filter((s) => s.includes("audit_events"))).toHaveLength(
    2,
  );
  expect(await service.receipt(actor, { receipt_id: uuid(99) })).toEqual(first);
  expect(await service.deliver(actor, command())).toEqual(first);
  expect(
    state.writes.filter((s) => s.startsWith("UPDATE public.orders")),
  ).toHaveLength(2);
  expect(
    (
      await service.deliver(actor, {
        ...command(),
        items: items.map((i) => ({ ...i, mode: "external_courier" })),
      })
    ).result.kind,
  ).toBe("receipt_mismatch");
});
test.each([{ mixed: true }, { conflict: true }])(
  "mixed or stale lot rolls back without receipt %o",
  async (patch) => {
    const { db, state } = fixture(patch),
      service = createDeliveryBatchService(db);
    expect((await service.deliver(actor, command())).result.kind).toBe(
      "conflict",
    );
    expect(state.writes).toHaveLength(0);
    expect(state.receipts.size).toBe(0);
  },
);
test("database failure after first order rolls back receipt and all writes", async () => {
  const { db, state } = fixture({ failAt: "order_status_events" }),
    service = createDeliveryBatchService(db);
  await expect(service.deliver(actor, command())).rejects.toThrow(
    "synthetic failure",
  );
  expect(state.writes).toHaveLength(0);
  expect(state.receipts.size).toBe(0);
});
test("permission and receipt scope deny unrelated actors", async () => {
  const { db, state } = fixture(),
    service = createDeliveryBatchService(db);
  expect(
    (
      await createDeliveryBatchService(fixture({ denied: true }).db).deliver(
        actor,
        command(),
      )
    ).kind,
  ).toBe("denied");
  await service.deliver(actor, command());
  expect(
    (
      await service.receipt(
        { ...actor, accountId: uuid(88) },
        { receipt_id: uuid(99) },
      )
    ).result.kind,
  ).toBe("receipt_missing");
  expect(state.receipts.size).toBe(1);
});
test("two submissions sharing a receipt serialize and deliver only once in a transactional double", async () => {
  const { db, state } = fixture(),
    service = createDeliveryBatchService(db);
  const [a, b] = await Promise.all([
    service.deliver(actor, command()),
    service.deliver(actor, command()),
  ]);
  expect(a).toEqual(b);
  expect(
    state.writes.filter((s) => s.startsWith("UPDATE public.orders")),
  ).toHaveLength(2);
});
