import { test, expect } from "vitest";
import {
  deliveryUrgency,
  deliveryUrgencyLabel,
} from "../../apps/web/src/features/orders/delivery-urgency.ts";

test("planned date takes precedence; future, J-2, due and late boundaries", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  expect(
    deliveryUrgency("manufacturing", "2026-10-23", "2026-10-18", now),
  ).toBeNull();
  expect(
    deliveryUrgency("manufacturing", "2026-10-22", "2026-10-18", now),
  ).toEqual({ level: "soon", provisional: false });
  expect(deliveryUrgency("completed", "2026-10-20", "2026-10-18", now)).toEqual(
    { level: "soon", provisional: false },
  );
  expect(deliveryUrgency("accepted", "2026-10-19", "2026-10-25", now)).toEqual({
    level: "late",
    provisional: false,
  });
});

test("requested date remains a provisional signal, never a lab commitment", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const warning = deliveryUrgency("accepted", null, "2026-10-19", now);
  expect(warning).toEqual({ level: "late", provisional: true });
  expect(deliveryUrgencyLabel(warning)).toContain("e përkohshme");
  expect(deliveryUrgency("accepted", null, null, now)).toBeNull();
});

test("terminal orders never emit progression alerts", () => {
  for (const status of ["delivered", "rejected", "cancelled"])
    expect(
      deliveryUrgency(
        status,
        "2026-10-01",
        null,
        new Date("2026-10-20T12:00:00Z"),
      ),
    ).toBeNull();
});

test("civil day is evaluated in Brussels around midnight and DST, not UTC", () => {
  expect(
    deliveryUrgency(
      "manufacturing",
      "2026-10-22",
      null,
      new Date("2026-10-19T22:30:00Z"),
    ),
  ).toEqual({ level: "soon", provisional: false });
  expect(
    deliveryUrgency(
      "manufacturing",
      "2026-03-31",
      null,
      new Date("2026-03-28T23:30:00Z"),
    ),
  ).toEqual({ level: "soon", provisional: false });
  expect(
    deliveryUrgency(
      "accepted",
      "not-a-date",
      null,
      new Date("2026-10-20T12:00:00Z"),
    ),
  ).toBeNull();
});
