import { expect, test } from "vitest";
import { appendModificationHistory } from "../../apps/web/src/features/orders/modification-history-page.ts";
const item = (id) => ({ id });
test("modification history retains prior decisions and deduplicates overlap", () => {
  const first = { items: [item("a"), item("b")], next_before_request_id: "b" };
  const next = {
    items: [item("b"), item("c"), item("c")],
    next_before_request_id: "c",
  };
  expect(appendModificationHistory(first, next, "b")).toEqual({
    items: [item("a"), item("b"), item("c")],
    next_before_request_id: "c",
  });
  expect(
    appendModificationHistory(
      first,
      { ...next, next_before_request_id: "b" },
      "b",
    )?.next_before_request_id,
  ).toBeNull();
});
test("stale cursor cannot overwrite a fresher history", () => {
  const current = { items: [item("new")], next_before_request_id: "new" };
  expect(
    appendModificationHistory(
      current,
      { items: [item("old")], next_before_request_id: null },
      "stale",
    ),
  ).toBe(current);
  expect(
    appendModificationHistory(current, {
      items: [item("fresh")],
      next_before_request_id: null,
    }),
  ).toEqual({ items: [item("fresh")], next_before_request_id: null });
});
