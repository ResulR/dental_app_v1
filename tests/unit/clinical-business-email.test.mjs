import { test, expect } from "vitest";
import { clinicalBusinessEmail } from "../../apps/api/dist/modules/notifications/clinical-business-email.js";
const events = [
  "order_accepted",
  "correction_requested",
  "order_rejected",
  "order_completed",
  "request_decided",
  "order_cancelled",
  "instructions_changed",
  "laboratory_order_created",
];
test("all eight clinical event intents have Albanian generic private portal copy", () => {
  for (const eventType of events) {
    const result = clinicalBusinessEmail({
      eventType,
      origin: "https://dental.example.test",
    });
    expect(result.subject.length).toBeGreaterThan(0);
    expect(result.text).toContain("https://dental.example.test/");
    expect(result.text).toContain("hyrje");
    expect(result.text).not.toMatch(
      /patient|emri|dhëmb|motivi|file|attachment/i,
    );
  }
});
test("no unrelated event, transport URL, credentials or free text enters the copy", () => {
  for (const eventType of [
    "order_submitted",
    "order_delivered",
    "message_created",
    "unknown",
  ])
    expect(() =>
      clinicalBusinessEmail({
        eventType,
        origin: "https://dental.example.test",
      }),
    ).toThrow("INVALID_CLINICAL_EMAIL_EVENT");
  for (const origin of [
    "http://dental.example.test",
    "https://user:pass@dental.example.test",
    "https://dental.example.test/path",
    "https://dental.example.test/?patient=secret",
    "https://dental.example.test#secret",
    "https://dental.example.test:443",
  ])
    expect(() =>
      clinicalBusinessEmail({ eventType: events[0], origin }),
    ).toThrow("INVALID_CLINICAL_EMAIL_ORIGIN");
});

test("private order fragment round trips from the clinical email and never accepts a URL or a free-form identifier", async () => {
  const { orderIdFromFragment, privateOrderFragment } =
    await import("@dental-lab/contracts");
  const id = "91000000-0000-4000-8000-000000000001";
  const args = {
    origin: "https://dental.example.test",
    eventType: "laboratory_order_created",
    orderId: id,
  };
  const link = new URL(
    clinicalBusinessEmail(args).text.match(/https:\/\/[^\s]+/)[0],
  );
  expect([link.origin, link.pathname, link.search]).toEqual([
    args.origin,
    "/",
    "",
  ]);
  expect(link.hash).toBe(privateOrderFragment(id));
  expect(orderIdFromFragment(link.hash)).toBe(id);
  for (const value of [
    "",
    "#order-tracking",
    link.hash + "?extra",
    "#/orders/https://example.test/",
  ])
    expect(orderIdFromFragment(value)).toBeNull();
  expect(() =>
    clinicalBusinessEmail({ ...args, orderId: id + "?extra" }),
  ).toThrow();
});
