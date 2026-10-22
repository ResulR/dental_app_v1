import { test, expect, vi } from "vitest";
import {
  createGeneralMessagingService,
  createOrderMessagingService,
  assertGeneralMessagingReady,
} from "../../apps/api/dist/modules/messaging/index.js";
import { generalMessagingEnabled } from "../../apps/api/dist/app/general-messaging-config.js";
import { orderMessagingEnabled } from "../../apps/api/dist/app/order-messaging-config.js";
const clinic = "91000000-0000-4000-8000-000000000001";
const other = "91000000-0000-4000-8000-000000000002";
const actor = { accountId: clinic, sessionId: clinic };
function fixture({
  profile = "clinic",
  grants = [],
  approved = true,
  foreign = false,
  hidden = false,
  missingReads = false,
  sequence = 1,
  order = false,
  closed = false,
} = {}) {
  const calls = [];
  let lastReadSeq = 0;
  const query = vi.fn(async (sql, args = []) => {
    calls.push([sql, args]);
    if (sql.startsWith("SELECT a.profile"))
      return {
        rows: [
          {
            profile,
            lifecycle: "active",
            securityLocked: false,
            resetRequired: false,
            sessionValid: true,
            ownerCurrent: true,
            clinicId: clinic,
            clinicSuspended: false,
            grants,
          },
        ],
      };
    if (sql.startsWith("SELECT id FROM public.clinics WHERE account_id=$1 AND"))
      return { rows: approved ? [{ id: clinic }] : [] };
    if (
      sql.startsWith(
        "SELECT clinic_id,last_message_seq::text FROM public.conversations",
      )
    )
      return {
        rows: foreign
          ? []
          : [{ clinic_id: clinic, last_message_seq: String(sequence) }],
      };
    if (sql.startsWith("SELECT clinic_id FROM public.conversations"))
      return {
        rows: foreign
          ? []
          : [{ clinic_id: clinic, last_message_seq: String(sequence) }],
      };
    if (
      sql.startsWith(
        "SELECT side,last_read_seq::text FROM public.conversation_reads",
      )
    )
      return {
        rows: missingReads
          ? []
          : [
              { side: "clinic", last_read_seq: String(lastReadSeq) },
              { side: "laboratory", last_read_seq: "0" },
            ],
      };
    if (
      sql.startsWith(
        "SELECT last_read_seq::text FROM public.conversation_reads",
      )
    )
      return {
        rows: missingReads ? [] : [{ last_read_seq: String(lastReadSeq) }],
      };
    if (sql.startsWith("SELECT 1 FROM public.messages WHERE"))
      return { rows: args[2] === 1 ? [{ "?column?": 1 }] : [] };
    if (sql.startsWith("UPDATE public.conversation_reads SET")) {
      lastReadSeq = args[2];
      return { rows: [] };
    }
    if (sql.includes("FROM public.conversations c\n"))
      return {
        rows: foreign
          ? []
          : [
              {
                id: clinic,
                order_id: clinic,
                clinic_id: clinic,
                closed_at: closed ? new Date() : null,
                last_message_seq: String(sequence),
                last_read_seq: missingReads ? null : String(lastReadSeq),
                other_side: missingReads ? null : "laboratory",
                unread_count: "1",
              },
            ],
      };
    if (sql.includes("FROM public.conversations c JOIN"))
      return {
        rows: [
          {
            id: clinic,
            clinic_id: clinic,
            clinic_name: "Clinic",
            last_message_seq: String(sequence),
            last_read_seq: missingReads ? null : String(lastReadSeq),
            unread_count: "1",
          },
        ],
      };
    if (sql.includes("FROM public.messages m JOIN")) {
      const numbers = Array.from(
        { length: sequence },
        (_, index) => index + 1,
      ).filter(
        (number) =>
          (args[2] === null || number < args[2]) &&
          (args[3] === null || number > args[3]),
      );
      if (sql.includes("DESC")) numbers.reverse();
      return {
        rows: numbers.slice(0, 51).map((number) => ({
          id: clinic,
          sequence_number: String(number),
          sender_side: "clinic",
          created_at: new Date("2026-10-21T10:00:00.000Z"),
          body: hidden ? null : "Synthetic",
          hidden,
          edited: false,
        })),
      };
    }
    return { rows: [] };
  });
  return {
    repo: (order ? createOrderMessagingService : createGeneralMessagingService)(
      {
        transaction: (fn) => fn({ query }),
      },
    ),
    calls,
  };
}
test("general messaging flag is closed and rejects an incomplete activation", () => {
  expect(generalMessagingEnabled({})).toBe(false);
  expect(() =>
    generalMessagingEnabled({ DENTAL_LAB_GENERAL_MESSAGING_ENABLED: "true" }),
  ).toThrow();
  expect(
    generalMessagingEnabled({
      DENTAL_LAB_GENERAL_MESSAGING_ENABLED: "true",
      DENTAL_LAB_REGISTRATION_ENABLED: "true",
    }),
  ).toBe(true);
});
test("order messaging remains closed without its separate flag and rejects incomplete activation", () => {
  expect(orderMessagingEnabled({})).toBe(false);
  expect(() =>
    orderMessagingEnabled({ DENTAL_LAB_ORDER_MESSAGING_ENABLED: "true" }),
  ).toThrow();
  expect(
    orderMessagingEnabled({
      DENTAL_LAB_ORDER_MESSAGING_ENABLED: "true",
      DENTAL_LAB_GENERAL_MESSAGING_ENABLED: "true",
    }),
  ).toBe(true);
});
test("clinic scoping forbids another clinic and unapproved accounts before message read", async () => {
  const f = fixture();
  expect((await f.repo.conversations(actor, { clinic_id: other })).kind).toBe(
    "denied",
  );
  expect(
    f.calls.some(([sql]) => sql.includes("FROM public.conversations c JOIN")),
  ).toBe(false);
  const unapproved = fixture({ approved: false });
  expect(
    (await unapproved.repo.messages(actor, { conversation_id: clinic })).kind,
  ).toBe("denied");
  expect(
    unapproved.calls.some(([sql]) =>
      sql.includes("FROM public.messages m JOIN"),
    ),
  ).toBe(false);
});
test("laboratory must have current general read permission", async () => {
  const f = fixture({ profile: "employee" });
  expect((await f.repo.conversations(actor, {})).kind).toBe("denied");
  const permitted = fixture({
    profile: "employee",
    grants: ["messaging.general.read"],
  });
  expect((await permitted.repo.conversations(actor, {})).kind).toBe("result");
});
test("conversation scope is checked before messages; hidden text stays absent", async () => {
  const foreign = fixture({ foreign: true });
  expect(
    (await foreign.repo.messages(actor, { conversation_id: clinic })).kind,
  ).toBe("denied");
  expect(
    foreign.calls.some(([sql]) => sql.includes("FROM public.messages m JOIN")),
  ).toBe(false);
  const f = fixture({ hidden: true });
  const result = await f.repo.messages(actor, { conversation_id: clinic });
  expect(result.kind).toBe("result");
  expect(result.result.messages[0].body).toBeNull();
  expect(result.result.last_read_seq).toBe(0);
  expect(result.result.other_read_seq).toBe(0);
  expect(result.result.last_message_seq).toBe(1);
  expect(result.result.next_after_seq).toBeNull();
  expect(
    f.calls.find(([sql]) => sql.includes("FROM public.messages m JOIN"))[1][1],
  ).toBe(clinic);
});

test("read receipt is monotone and an idempotent retry never rewrites the marker", async () => {
  const f = fixture();
  const first = await f.repo.markRead(actor, {
    conversation_id: clinic,
    through_seq: 1,
  });
  expect(first).toMatchObject({ kind: "result", result: { last_read_seq: 1 } });
  const again = await f.repo.markRead(actor, {
    conversation_id: clinic,
    through_seq: 1,
  });
  expect(again).toMatchObject({ kind: "result", result: { last_read_seq: 1 } });
  expect(
    f.calls.filter(([sql]) =>
      sql.startsWith("UPDATE public.conversation_reads SET"),
    ),
  ).toHaveLength(1);
  const page = await f.repo.messages(actor, { conversation_id: clinic });
  expect(page.result.last_read_seq).toBe(1);
});
test("read rejects foreign scope, invalid sequence, and missing historic markers without mutation", async () => {
  for (const [options, through_seq, kind] of [
    [{ foreign: true }, 1, "denied"],
    [{}, 2, "invalid"],
    [{ missingReads: true }, 1, "unavailable"],
    [{ approved: false }, 1, "denied"],
  ]) {
    const f = fixture(options);
    expect(
      (await f.repo.markRead(actor, { conversation_id: clinic, through_seq }))
        .kind,
    ).toBe(kind);
    expect(
      f.calls.some(([sql]) =>
        sql.startsWith("UPDATE public.conversation_reads SET"),
      ),
    ).toBe(false);
  }
  const f = fixture({ missingReads: true });
  expect((await f.repo.messages(actor, { conversation_id: clinic })).kind).toBe(
    "unavailable",
  );
});
test("forward catch-up and backward history each paginate without gaps or duplicates", async () => {
  const f = fixture({ sequence: 120 });
  const first = await f.repo.messages(actor, {
    conversation_id: clinic,
    after_seq: 0,
  });
  expect(
    first.result.messages.map((message) => message.sequence_number),
  ).toEqual(Array.from({ length: 50 }, (_, index) => index + 1));
  expect(first.result.next_after_seq).toBe(50);
  const second = await f.repo.messages(actor, {
    conversation_id: clinic,
    after_seq: 50,
  });
  expect(second.result.messages[0].sequence_number).toBe(51);
  expect(second.result.next_after_seq).toBe(100);
  const third = await f.repo.messages(actor, {
    conversation_id: clinic,
    after_seq: 100,
  });
  expect(third.result.messages.at(-1).sequence_number).toBe(120);
  expect(third.result.next_after_seq).toBeNull();
  const latest = await f.repo.messages(actor, { conversation_id: clinic });
  expect(latest.result.messages[0].sequence_number).toBe(71);
  expect(latest.result.next_before_seq).toBe(71);
  const older = await f.repo.messages(actor, {
    conversation_id: clinic,
    before_seq: 71,
  });
  expect(older.result.messages.at(-1).sequence_number).toBe(70);
  expect(older.result.next_before_seq).toBe(21);
  expect(
    (
      await f.repo.messages(actor, {
        conversation_id: clinic,
        before_seq: 71,
        after_seq: 0,
      })
    ).kind,
  ).toBe("invalid");
});
test("conversation list counts only messages from the other side after the own read cursor", async () => {
  const f = fixture();
  const result = await f.repo.conversations(actor, {});
  expect(result.result.items[0].unread_count).toBe(1);
  const [sql, args] = f.calls.find(([text]) =>
    text.includes("AS unread_count"),
  );
  expect(sql).toContain(
    "m.sequence_number>r.last_read_seq AND m.sender_side<>$3",
  );
  expect(args[2]).toBe("clinic");
});
test("conversation list does not present absent historic read markers as zero unread", async () => {
  const f = fixture({ missingReads: true });
  expect((await f.repo.conversations(actor, {})).kind).toBe("unavailable");
});
test("order conversations are scoped to their order and the order-specific permission", async () => {
  const f = fixture({ order: true });
  const result = await f.repo.orderConversation(actor, { order_id: clinic });
  expect(result).toMatchObject({
    kind: "result",
    result: {
      id: clinic,
      order_id: clinic,
      closed: false,
      unread_count: 1,
    },
  });
  expect((await f.repo.messages(actor, { conversation_id: clinic })).kind).toBe(
    "result",
  );
  const lookup = f.calls.find(([sql]) =>
    sql.includes("FROM public.conversations c\n"),
  );
  expect(lookup[0]).toContain("c.kind='order' AND c.order_id=$1");
  expect(lookup[1]).toEqual([clinic, clinic, "clinic"]);
  const readQuery = f.calls.find(([sql]) =>
    sql.startsWith("SELECT clinic_id,last_message_seq::text"),
  );
  expect(readQuery[1][2]).toBe("order");
  expect((await f.repo.conversations(actor, {})).kind).toBe("invalid");
  const foreign = fixture({ order: true, foreign: true });
  expect(
    (await foreign.repo.orderConversation(actor, { order_id: clinic })).kind,
  ).toBe("denied");
  const old = fixture({ order: true, missingReads: true });
  expect(
    (await old.repo.orderConversation(actor, { order_id: clinic })).kind,
  ).toBe("unavailable");
  const closed = fixture({ order: true, closed: true });
  expect(
    (await closed.repo.orderConversation(actor, { order_id: clinic })).result
      .closed,
  ).toBe(true);
});
test("laboratory order read needs order permission, not general messaging permission", async () => {
  const wrong = fixture({
    order: true,
    profile: "employee",
    grants: ["messaging.general.read"],
  });
  expect(
    (await wrong.repo.orderConversation(actor, { order_id: clinic })).kind,
  ).toBe("denied");
  const right = fixture({
    order: true,
    profile: "employee",
    grants: ["orders.read_logistics", "messaging.order.read"],
  });
  expect(
    (await right.repo.orderConversation(actor, { order_id: clinic })).kind,
  ).toBe("result");
});
test("startup refuses missing messaging storage privileges", async () => {
  await expect(
    assertGeneralMessagingReady({
      query: async () => ({ rows: [{ ready: false }] }),
    }),
  ).rejects.toThrow("GENERAL_MESSAGING_STORAGE_NOT_READY");
  await expect(
    assertGeneralMessagingReady({
      query: async () => ({ rows: [{ ready: true }] }),
    }),
  ).resolves.toBeUndefined();
});
