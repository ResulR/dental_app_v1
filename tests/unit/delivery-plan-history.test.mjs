import { expect, test } from "vitest";
import { appendDeliveryPlanHistory } from "../../apps/web/src/features/orders/delivery-plan-history.ts";
const item = (id) => ({ id });
const current = {
  order_id: "order-a",
  logistics_revision: 4,
  items: [item("a"), item("b")],
  next_before_event_id: "b",
};
test("older planning dates preserve order and deduplicate overlapping events", () => {
  expect(
    appendDeliveryPlanHistory(
      current,
      {
        ...current,
        items: [item("c"), item("c"), item("d")],
        next_before_event_id: null,
      },
      "b",
    ),
  ).toEqual({
    ...current,
    items: [item("a"), item("b"), item("c"), item("d")],
    next_before_event_id: null,
  });
});
test("late, foreign, changed revision and nonprogressing pages are rejected", () => {
  const page = { ...current, items: [item("c")], next_before_event_id: null };
  expect(appendDeliveryPlanHistory(current, page, "old")).toBeNull();
  expect(
    appendDeliveryPlanHistory(current, { ...page, order_id: "order-b" }, "b"),
  ).toBeNull();
  expect(
    appendDeliveryPlanHistory(current, { ...page, logistics_revision: 5 }, "b"),
  ).toBeNull();
  expect(
    appendDeliveryPlanHistory(current, { ...page, items: [item("b")] }, "b"),
  ).toBeNull();
  expect(
    appendDeliveryPlanHistory(
      current,
      { ...page, items: [], next_before_event_id: "c" },
      "b",
    ),
  ).toBeNull();
});
