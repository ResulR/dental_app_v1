import { test, expect } from "vitest";
import { appendActionInboxPage } from "../../apps/web/src/features/orders/action-inbox-page.ts";
const row = (id, revision = 1) => ({ kind: "retouch", id, revision });
const page = (items, next_after, permissions = ["orders.read_details"]) => ({
  items, next_after, permissions,
});
test("older action pages retain earlier actions without overlapping duplicates", () => {
  const first = page([row("a"), row("b")], { id: "b" });
  expect(appendActionInboxPage(first, page([row("b", 2), row("c")], null))).toEqual(
    page([row("a"), row("b"), row("c")], null),
  );
});
test("changed permissions discard earlier actions and repeated cursor stops pagination", () => {
  const first = page([row("a")], { id: "a" });
  expect(appendActionInboxPage(first, page([row("c")], null, []))).toEqual(
    page([row("c")], null, []),
  );
  expect(appendActionInboxPage(first, page([row("a")], { id: "a" })).next_after).toBeNull();
});
