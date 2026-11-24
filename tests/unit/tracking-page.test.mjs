import { expect, test } from "vitest";
import { appendTrackingPage } from "../../apps/web/src/features/orders/tracking-page.ts";
const row = (id) => ({ id });
const page = (ids, cursor, can_read_details = true) => ({
  items: ids.map(row), next_after: cursor, can_read_details,
});
test("tracking pages retain older rows without overlap and stop on repeated cursor", () => {
  const first = page(["a", "b"], "b");
  expect(appendTrackingPage(first, page(["b", "c"], "c"), "b")).toEqual(page(["a", "b", "c"], "c"));
  expect(appendTrackingPage(first, page(["b"], "b"), "b")?.next_after).toBeNull();
});
test("stale cursor cannot mutate a newer list and changed detail rights discard cached rows", () => {
  const first = page(["a"], "a");
  expect(appendTrackingPage(first, page(["b"], null), "other")).toBe(first);
  expect(appendTrackingPage(first, page(["b"], null, false), "a")).toBeNull();
});
