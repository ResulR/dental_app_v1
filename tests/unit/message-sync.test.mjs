import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  appendConversationPage,
  catchUpMessages,
  createReadFlight,
  hasAuthorizedConversation,
  contiguousReadThrough,
  confirmsMutatedMessage,
  mergeMessagePage,
} from "../../apps/web/src/features/messaging/message-sync.ts";

const id = "91000000-0000-4000-8000-000000000001";
test("conversation pagination ignores stale refreshes and overlapping rows", () => {
  const item = (id) => ({
    id,
    clinic_id: id,
    clinic_name: "Test",
    last_message_seq: 0,
    unread_count: 0,
  });
  const first = { items: [item("a"), item("b")], next_after: "b" };
  const incoming = { items: [item("b"), item("c")], next_after: null };
  expect(
    appendConversationPage(first, first, incoming, "b")?.items.map(
      (row) => row.id,
    ),
  ).toEqual(["a", "b", "c"]);
  const refreshed = { items: [item("z")], next_after: "z" };
  expect(appendConversationPage(refreshed, first, incoming, "b")).toBe(
    refreshed,
  );
  expect(appendConversationPage(first, first, incoming, "other")).toBe(first);
  const repeated = appendConversationPage(
    first,
    first,
    { items: [item("c"), item("c")], next_after: "b" },
    "b",
  );
  expect(repeated?.items.map((row) => row.id)).toEqual(["a", "b", "c"]);
  expect(repeated?.next_after).toBeNull();
});
test("a refreshed conversation list must retain the selected clinic and identity", () => {
  const old = { id: "selected", clinic_id: "clinic-a" };
  expect(
    hasAuthorizedConversation(
      { items: [old], next_after: null },
      old.id,
      old.clinic_id,
    ),
  ).toBe(true);
  expect(
    hasAuthorizedConversation(
      { items: [], next_after: null },
      old.id,
      old.clinic_id,
    ),
  ).toBe(false);
  expect(
    hasAuthorizedConversation(
      { items: [{ ...old, clinic_id: "clinic-b" }], next_after: null },
      old.id,
      old.clinic_id,
    ),
  ).toBe(false);
});
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
test("message mutation needs a fresh receipt for the exact conversation and message", () => {
  const result = page(4, 4);
  result.messages[0].revision = 2;
  expect(confirmsMutatedMessage(result, id, id, 2)).toBe(true);
  expect(confirmsMutatedMessage(result, id, id, 3)).toBe(false);
  expect(confirmsMutatedMessage(result, "foreign", id, 2)).toBe(false);
  expect(confirmsMutatedMessage(result, id, "other", 2)).toBe(false);
  expect(confirmsMutatedMessage({ ...result, messages: [] }, id, id, 2)).toBe(
    false,
  );
});
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
  expect(
    await catchUpMessages(current, fetchPage, (received) => {
      current = mergeMessagePage(current, received);
    }),
  ).toBe(true);
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
  ).rejects.toThrow("MESSAGE_CATCH_UP_GAP");
});
test("large reconnection backlog remains visibly incomplete until subsequent bounded catch-up", async () => {
  let current = page(1, 10);
  const fetchPage = async (query) => {
    if (query.after_seq === undefined) return page(502, 551);
    const from = query.after_seq + 1;
    const to = Math.min(from + 49, 551);
    return page(from, to, { next_after_seq: to < 551 ? to : null });
  };
  const accept = (received) => {
    current = mergeMessagePage(current, received);
  };
  expect(await catchUpMessages(current, fetchPage, accept)).toBe(false);
  expect(current.messages.at(-1).sequence_number).toBe(260);
  expect(await catchUpMessages(current, fetchPage, accept)).toBe(false);
  expect(current.messages.at(-1).sequence_number).toBe(510);
  expect(await catchUpMessages(current, fetchPage, accept)).toBe(true);
  expect(current.messages.at(-1).sequence_number).toBe(551);
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

test("reconnection refuses missing sequences, foreign pages and stale snapshots before merging", async () => {
  const current = page(1, 10);
  for (const fresh of [
    {
      ...page(11, 12),
      conversation_id: "91000000-0000-4000-8000-000000000002",
    },
    {
      ...page(11, 12),
      messages: [page(11, 11).messages[0], page(13, 13).messages[0]],
    },
    page(1, 9),
  ]) {
    const accepted = [];
    await expect(
      catchUpMessages(
        current,
        async () => fresh,
        (p) => accepted.push(p),
      ),
    ).rejects.toThrow();
    expect(accepted).toEqual([]);
  }
  for (const forward of [
    page(12, 13),
    page(11, 12, { next_after_seq: 11 }),
    page(11, 12, { last_message_seq: 13 }),
    {
      ...page(11, 12),
      conversation_id: "91000000-0000-4000-8000-000000000002",
    },
  ]) {
    const accepted = [];
    await expect(
      catchUpMessages(
        current,
        async ({ after_seq }) =>
          after_seq === undefined ? page(101, 150) : forward,
        (p) => accepted.push(p),
      ),
    ).rejects.toThrow();
    expect(accepted).toEqual([]);
  }
});
test("cancelled conversation read cannot block or release the next conversation", () => {
  const flight = createReadFlight();
  const first = flight.begin();
  expect(first).not.toBeNull();
  expect(flight.begin()).toBeNull();
  expect(flight.finish(first)).toBe(true); // selection changed while response pending
  const next = flight.begin();
  expect(next).not.toBeNull();
  expect(flight.finish(first)).toBe(false); // old response finally arrives
  expect(flight.busy).toBe(true);
  expect(flight.finish(next)).toBe(true);
  expect(flight.busy).toBe(false);
});
