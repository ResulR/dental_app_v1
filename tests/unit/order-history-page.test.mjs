import { expect, test } from "vitest";
import { appendOrderHistory } from "../../apps/web/src/features/orders/order-history-page.ts";
const event = (aggregate_revision) => ({ aggregate_revision });
const order = { id: "work-a", revision: 120, status: "delivered" };
test("older history is appended without losing current events", () => {
  const current = {
    order,
    history: [event(120), event(119)],
    next_before_revision: 119,
  };
  const older = {
    order,
    history: [event(118), event(117), event(117)],
    next_before_revision: 117,
  };
  expect(appendOrderHistory(current, older, 119)).toEqual({
    order,
    history: [event(120), event(119), event(118), event(117)],
    next_before_revision: 117,
  });
  expect(
    appendOrderHistory(current, { ...older, next_before_revision: 119 }, 119)
      ?.next_before_revision,
  ).toBeNull();
});
test("changed current revision, foreign work and invalid page fail closed", () => {
  const current = { order, history: [event(120)], next_before_revision: 120 };
  const older = { order, history: [event(119)], next_before_revision: null };
  expect(appendOrderHistory(current, older, 119)).toBe(current);
  expect(
    appendOrderHistory(
      current,
      { ...older, order: { ...order, revision: 121 } },
      120,
    ),
  ).toBeNull();
  expect(
    appendOrderHistory(
      current,
      { ...older, order: { ...order, id: "foreign" } },
      120,
    ),
  ).toBeNull();
  expect(
    appendOrderHistory(current, { ...older, history: [event(120)] }, 120),
  ).toBeNull();
});
