import { test, expect } from "vitest";
import { mergeInboxPage } from "../../apps/web/src/features/messaging/inbox-selection.ts";
const item = (id, count) => ({ conversation_id: id, unread_count: count });
test("overlapping page preserves recent rows and advances cursor", () => {
  const merged = mergeInboxPage(
    {
      items: [item("a", 2), item("b", 3)],
      next_before_at: "old",
      next_before_id: "b",
    },
    {
      items: [item("b", 1), item("c", 4), item("c", 2)],
      next_before_at: "older",
      next_before_id: "c",
    },
  );
  expect(merged.items).toEqual([item("a", 2), item("b", 3), item("c", 4)]);
  expect(merged.next_before_id).toBe("c");
});
test("unchanged cursor stops an overlapping or empty pagination loop", () => {
  const current = {
    items: [item("a", 2)],
    next_before_at: "old",
    next_before_id: "a",
  };
  expect(
    mergeInboxPage(current, { ...current, items: [item("a", 0)] }),
  ).toEqual({ ...current, next_before_at: null, next_before_id: null });
});
