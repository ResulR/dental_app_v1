import { expect, test } from "vitest";
import { canEditReceiptIdentifier } from "../../apps/web/src/features/orders/delivery-receipt-input.ts";
test("an uncertain generated batch receipt cannot be overwritten to create another intent", () => {
  expect(canEditReceiptIdentifier(true, true)).toBe(false);
  expect(canEditReceiptIdentifier(false, true)).toBe(false);
  expect(canEditReceiptIdentifier(true, false)).toBe(false);
});
test("manual receipt lookup remains possible after a reload with no pending attempt", () => {
  expect(canEditReceiptIdentifier(false, false)).toBe(true);
});
