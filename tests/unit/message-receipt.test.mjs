import { test, expect } from "vitest";
import { confirmsMessageReceipt } from "../../apps/web/src/features/messaging/message-receipt.ts";
const uuid = (n) => "92000000-0000-4000-8000-" + String(n).padStart(12, "0");
const receipt = {
  kind: "sent",
  persisted: true,
  message_id: uuid(1),
  version_id: uuid(2),
  sequence_number: 4,
  created_at: "2026-11-28T09:00:00.000Z",
  replayed: true,
};
const page = {
  conversation_id: uuid(3),
  last_read_seq: 0,
  other_read_seq: 0,
  last_message_seq: 4,
  next_before_seq: null,
  next_after_seq: null,
  messages: [
    {
      id: uuid(1),
      sequence_number: 4,
      sender_side: "clinic",
      own: true,
      revision: 1,
      body: "Mesazh",
      created_at: receipt.created_at,
      hidden: false,
      edited: false,
    },
  ],
};
test("receipt must be found in the authorized conversation with own ID, sequence and creation time", () => {
  expect(confirmsMessageReceipt(page, uuid(3), "Mesazh", receipt)).toBe(true);
  expect(confirmsMessageReceipt(page, uuid(4), "Mesazh", receipt)).toBe(false);
  expect(
    confirmsMessageReceipt(
      { ...page, messages: [{ ...page.messages[0], own: false }] },
      uuid(3),
      "Mesazh",
      receipt,
    ),
  ).toBe(false);
  expect(
    confirmsMessageReceipt(page, uuid(3), "Mesazh", {
      ...receipt,
      message_id: uuid(5),
    }),
  ).toBe(false);
  expect(
    confirmsMessageReceipt(page, uuid(3), "Mesazh", {
      ...receipt,
      sequence_number: 5,
    }),
  ).toBe(false);
  expect(
    confirmsMessageReceipt(page, uuid(3), "Mesazh", {
      ...receipt,
      created_at: "2026-11-29T09:00:00.000Z",
    }),
  ).toBe(false);
  expect(confirmsMessageReceipt(page, uuid(3), "Tjetër", receipt)).toBe(false);
  expect(
    confirmsMessageReceipt(
      { ...page, messages: [{ ...page.messages[0], revision: 2 }] },
      uuid(3),
      "Mesazh",
      receipt,
    ),
  ).toBe(false);
});
