import { expect, test } from "vitest";
import { appendLinkedWorkPage } from "../../apps/web/src/features/orders/linked-work-page.ts";

const link = (id) => ({ id });
const order = { id: "work", number: "1", status: "delivered" };
test("linked work pagination keeps history without duplicates and refreshes permissions", () => {
  const first = {
    order,
    can_read_details: true,
    items: [link("a"), link("b")],
    next_after: "b",
  };
  const next = {
    order: { ...order, status: "completed" },
    can_read_details: false,
    items: [link("b"), link("c"), link("c")],
    next_after: null,
  };
  expect(appendLinkedWorkPage(first, first, next, "b")).toEqual({
    ...next,
    items: [link("a"), link("b"), link("c")],
  });
  expect(
    appendLinkedWorkPage(first, first, { ...next, next_after: "b" }, "b")
      ?.next_after,
  ).toBeNull();
});
test("a changed list, cursor or work cannot be merged", () => {
  const first = {
    order,
    can_read_details: true,
    items: [link("a")],
    next_after: "a",
  };
  const next = { ...first, items: [link("b")], next_after: null };
  expect(appendLinkedWorkPage(next, first, next, "a")).toBe(next);
  expect(appendLinkedWorkPage(first, first, next, "other")).toBe(first);
  expect(
    appendLinkedWorkPage(
      first,
      first,
      { ...next, order: { ...order, id: "foreign" } },
      "a",
    ),
  ).toBeNull();
});
