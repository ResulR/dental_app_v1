import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  catchUpMessages,
  contiguousReadThrough,
  mergeMessagePage,
} from "../../apps/web/src/features/messaging/message-sync.ts";

const id = "91000000-0000-4000-8000-000000000001";
function page(from, to, options = {}) {
  return {
    conversation_id: id,
    last_read_seq: 0,
    other_read_seq: 0,
    last_message_seq: to,
    next_before_seq: null,
    next_after_seq: null,
    messages: Array.from({ length: to - from + 1 }, (_, index) => ({
      id,
      sequence_number: from + index,
      sender_side: "clinic",
      body: "Test",
      created_at: "2026-10-21T10:00:00.000Z",
      hidden: false,
      edited: false,
    })),
    ...options,
  };
}
test("read cursor only advances through actually visible contiguous messages", () => {
  expect(contiguousReadThrough(0, new Set([71, 72]))).toBe(0);
  expect(contiguousReadThrough(70, new Set([71, 72, 74]))).toBe(72);
  expect(contiguousReadThrough(72, new Set([73, 74]))).toBe(74);
});
test("reconnection merges deduplicated batches and never regresses read receipts", () => {
  const current = page(1, 50, { last_read_seq: 20, other_read_seq: 25 });
  const next = page(48, 80, { last_read_seq: 10, other_read_seq: 22 });
  const result = mergeMessagePage(current, next);
  expect(result.messages.map((item) => item.sequence_number)).toEqual(
    Array.from({ length: 80 }, (_, index) => index + 1),
  );
  expect(result.last_read_seq).toBe(20);
  expect(result.other_read_seq).toBe(25);
  expect(mergeMessagePage(result, next).messages).toHaveLength(80);
});
test("older pages keep historical pagination while newer windows remain bounded", () => {
  const latest = page(101, 150, { next_before_seq: 101 });
  const older = page(51, 100, { next_before_seq: 51 });
  const merged = mergeMessagePage(latest, older, true);
  expect(merged.messages[0].sequence_number).toBe(51);
  expect(merged.next_before_seq).toBe(51);
  const large = mergeMessagePage(merged, page(100, 400));
  expect(large.messages).toHaveLength(250);
  expect(large.next_before_seq).toBe(151);
});
test("catch-up fetches every bounded forward page before considering newest sequence loaded", async () => {
  let current = page(1, 10);
  const calls = [];
  const fetchPage = async (query) => {
    calls.push(query);
    if (query.after_seq === undefined) return page(101, 150);
    const from = query.after_seq + 1;
    const to = Math.min(from + 49, 150);
    return page(from, to, { next_after_seq: to < 150 ? to : null });
  };
  await catchUpMessages(current, fetchPage, (received) => {
    current = mergeMessagePage(current, received);
  });
  expect(calls.map((query) => query.after_seq)).toEqual([
    undefined,
    10,
    60,
    110,
  ]);
  expect(current.messages.map((message) => message.sequence_number)).toEqual(
    Array.from({ length: 150 }, (_, index) => index + 1),
  );
  await expect(
    catchUpMessages(
      page(1, 10),
      async (query) =>
        query.after_seq === undefined ? page(101, 150) : page(1, 10),
      () => {},
    ),
  ).rejects.toThrow("MESSAGE_CATCH_UP_STALLED");
});
test("versioned backfill adds missing sides with zero cursor without rewriting existing reads", () => {
  const sql = readFileSync(
    new URL(
      "../../migrations/0023_conversation_read_markers_backfill.sql",
      import.meta.url,
    ),
    "utf8",
  );
  expect(sql).toMatch(
    /INSERT INTO public\.conversation_reads\(conversation_id,side,last_read_seq\)/,
  );
  expect(sql).toMatch(/SELECT c\.id, sides\.side, 0/);
  expect(sql).toMatch(/NOT EXISTS/);
  expect(sql).toMatch(/ON CONFLICT \(conversation_id,side\) DO NOTHING/);
  expect(sql).not.toMatch(/UPDATE public\.conversation_reads/);
});
