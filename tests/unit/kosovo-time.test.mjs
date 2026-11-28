import { test, expect } from "vitest";
import { laboratoryToday } from "../../apps/web/src/features/orders/calendar-period.ts";
import { deliveryUrgency } from "../../apps/web/src/features/orders/delivery-urgency.ts";
const local = (value) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Skopje",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return [
    get("year"),
    get("month"),
    get("day"),
    get("hour"),
    get("minute"),
  ].join("-");
};
test("Kosovo civil clock crosses summer and winter DST boundaries without changing stored UTC instants", () => {
  expect(local("2026-03-29T00:59:00Z")).toBe("2026-03-29-01-59");
  expect(local("2026-03-29T01:00:00Z")).toBe("2026-03-29-03-00");
  expect(local("2026-10-25T00:59:00Z")).toBe("2026-10-25-02-59");
  expect(local("2026-10-25T01:00:00Z")).toBe("2026-10-25-02-00");
  expect(laboratoryToday(new Date("2026-03-28T23:30:00Z"))).toBe("2026-03-29");
  expect(laboratoryToday(new Date("2026-10-24T22:30:00Z"))).toBe("2026-10-25");
  expect(
    deliveryUrgency(
      "accepted",
      "2026-03-28",
      null,
      new Date("2026-03-28T23:30:00Z"),
    ),
  ).toMatchObject({ level: "late" });
});
