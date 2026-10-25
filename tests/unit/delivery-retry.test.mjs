import { expect, test } from "vitest";
import { nextDeliveryRetry } from "../../apps/api/dist/modules/notifications/delivery-retry.js";

const now = new Date("2026-10-25T12:00:00.000Z");
test("temporary failures use bounded exponential retry without immediate loop", () => {
  expect(nextDeliveryRetry("temporary_error", 1, now)).toEqual({
    state: "pending",
    nextAttemptAt: new Date("2026-10-25T12:00:30.000Z"),
  });
  expect(nextDeliveryRetry("temporary_error", 2, now).nextAttemptAt).toEqual(
    new Date("2026-10-25T12:01:00.000Z"),
  );
  expect(nextDeliveryRetry("temporary_error", 1000, now).nextAttemptAt).toEqual(
    new Date("2026-10-25T13:00:00.000Z"),
  );
});
test("permanent and ambiguous outcomes require intervention, no blind retry", () => {
  for (const outcome of ["permanent_error", "ambiguous"])
    expect(nextDeliveryRetry(outcome, 1, now)).toEqual({
      state: "failed",
      nextAttemptAt: null,
    });
});
test("invalid counters, clock and outcomes fail closed", () => {
  for (const n of [0, -1, 1.5, NaN])
    expect(() => nextDeliveryRetry("temporary_error", n, now)).toThrow();
  expect(() =>
    nextDeliveryRetry("temporary_error", 1, new Date(NaN)),
  ).toThrow();
  expect(() => nextDeliveryRetry("unknown", 1, now)).toThrow();
});
