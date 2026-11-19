import { test, expect } from "vitest";
import { laboratoryBusinessEmail } from "../../apps/api/dist/modules/notifications/laboratory-business-email.js";
import { laboratoryMailCategories } from "../../apps/api/dist/modules/notifications/business-event-policy.js";

test("six laboratory categories receive only generic Albanian private portal copy", () => {
  expect(laboratoryMailCategories).toHaveLength(6);
  for (const eventType of laboratoryMailCategories) {
    const copy = laboratoryBusinessEmail({
      eventType,
      origin: "https://dental.example.test",
    });
    expect(copy.subject.length).toBeGreaterThan(0);
    expect(copy.text).toContain("https://dental.example.test/");
    expect(copy.text).toContain("lejet aktuale");
    expect(copy.text).not.toMatch(/patient|emri|dhëmb|motivi|file|attachment/i);
  }
});
test("no clinical, delivery, urgency or message event generates laboratory mail", () => {
  for (const eventType of [
    "order_accepted",
    "order_delivered",
    "deadline_overdue",
    "message_created",
    "unknown",
  ])
    expect(() =>
      laboratoryBusinessEmail({
        eventType,
        origin: "https://dental.example.test",
      }),
    ).toThrow("INVALID_LABORATORY_EMAIL_EVENT");
  for (const origin of [
    "http://dental.example.test",
    "https://user:pass@dental.example.test",
    "https://dental.example.test/path",
    "https://dental.example.test/?patient=secret",
  ])
    expect(() =>
      laboratoryBusinessEmail({
        eventType: laboratoryMailCategories[0],
        origin,
      }),
    ).toThrow("INVALID_LABORATORY_EMAIL_ORIGIN");
});
