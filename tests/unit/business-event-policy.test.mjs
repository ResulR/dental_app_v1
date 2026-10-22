import { readFileSync } from "node:fs";
import { test, expect } from "vitest";
import {
  businessMailIntent,
  laboratoryMailCategories,
} from "../../apps/api/dist/modules/notifications/business-event-policy.js";

const schema = readFileSync(
  "migrations/0008_events_notifications_audit.sql",
  "utf8",
);
const categories = schema
  .match(/category text NOT NULL CHECK\(category IN \(([^)]+)\)\)/)?.[1]
  .match(/'[^']+'/g)
  .map((value) => value.slice(1, -1));
const eventTypes = schema
  .match(/type text NOT NULL CHECK\(type IN \(([^)]+)\)\)/)?.[1]
  .match(/'[^']+'/g)
  .map((value) => value.slice(1, -1));

test("exact six laboratory categories agree with the existing SQL constraint", () => {
  expect([...laboratoryMailCategories].sort()).toEqual(categories?.sort());
  expect(new Set(laboratoryMailCategories).size).toBe(6);
  for (const category of laboratoryMailCategories)
    expect(businessMailIntent(category)).toEqual({
      audience: "laboratory",
      category,
    });
});

test("clinical decisions get an intent but delivery and other state changes do not", () => {
  const clinical = [
    "order_accepted",
    "correction_requested",
    "order_rejected",
    "order_completed",
    "request_decided",
    "order_cancelled",
    "instructions_changed",
    "laboratory_order_created",
  ];
  for (const type of clinical)
    expect(businessMailIntent(type)).toEqual({ audience: "clinic" });
  expect(eventTypes).toEqual(
    expect.arrayContaining([...clinical, ...laboratoryMailCategories]),
  );
  for (const type of eventTypes.filter(
    (type) =>
      !clinical.includes(type) && !laboratoryMailCategories.includes(type),
  ))
    expect(businessMailIntent(type)).toBeNull();
  expect(businessMailIntent("unknown")).toBeNull();
  expect(businessMailIntent("order_delivered")).toBeNull();
  expect(businessMailIntent("message_created")).toBeNull();
});
