import { expect, test } from "vitest";
import { showRetouchEntry } from "../../apps/web/src/features/orders/retouch-entry.ts";

test("a delivered work exposes one retouch entry when its detail is open", () => {
  expect(showRetouchEntry(true, "delivered", "work-a", undefined, "list")).toBe(
    true,
  );
  expect(showRetouchEntry(true, "delivered", "work-a", "work-a", "list")).toBe(
    false,
  );
  expect(
    showRetouchEntry(true, "delivered", "work-a", "work-a", "detail"),
  ).toBe(true);
  expect(showRetouchEntry(true, "delivered", "work-b", "work-a", "list")).toBe(
    true,
  );
});
test("no retouch entry for laboratory or a work that is not delivered", () => {
  for (const status of ["pending", "rejected", "cancelled", "completed"]) {
    expect(showRetouchEntry(true, status, "work-a", undefined, "list")).toBe(
      false,
    );
    expect(showRetouchEntry(true, status, "work-a", "work-a", "detail")).toBe(
      false,
    );
  }
  expect(
    showRetouchEntry(false, "delivered", "work-a", "work-a", "detail"),
  ).toBe(false);
});
