// PREPARATION ONLY. Run solely via guarded v6 shell after separate authorization.
import assert from "node:assert/strict";
import pg from "pg";
import { setTimeout as delay } from "node:timers/promises";
import {
  createGeneralMessagingService,
  createOrderMessagingService,
  createMessageSubmissionService,
  createMessagingInboxService,
} from "../../apps/api/dist/modules/messaging/index.js";
import { createInternalNoticeService } from "../../apps/api/dist/modules/notifications/index.js";
const root = "/srv/dental-lab/.local/messaging-v6";
const port = 55436;
const id = (p, n) => p + "000000-0000-4000-8000-" + String(n).padStart(12, "0");
const account = (n, session = n) => ({
  accountId: id("71", n),
  sessionId: id("77", session),
});
const clinic = account(2),
  clinicAgain = account(2, 6),
  other = account(3);
const generalOnly = account(4),
  both = account(5);
const conv = (n) => id("79", n),
  order = (n) => id("75", n);
const connections = [];
let assertions = 0;
function equal(actual, expected) {
  assert.deepEqual(actual, expected);
  assertions++;
}
async function connect() {
  const client = new pg.Client({
    host: root + "/socket",
    port,
    database: "dental_lab",
    user: "postgres",
    connectionTimeoutMillis: 3000,
    query_timeout: 9000,
  });
  client.on("error", () => {});
  await client.connect();
  connections.push(client);
  const {
    rows: [r],
  } = await client.query(
    "SELECT current_database() db,current_setting('data_directory') dir,current_setting('port') port,current_setting('server_version_num')::int version",
  );
  equal([r.db, r.dir, r.port], ["dental_lab", root + "/pgdata", String(port)]);
  assert.ok(r.version >= 170000 && r.version < 180000);
  assertions++;
  return client;
}
function db(client, hook = async () => {}) {
  return {
    transaction: async (work) => {
      await client.query("BEGIN");
      try {
        await client.query("SET LOCAL ROLE dental_lab_app");
        await client.query("SET LOCAL statement_timeout='8s'");
        await client.query("SET LOCAL lock_timeout='4s'");
        const result = await work({
          query: async (sql, values) => {
            const answer = await client.query(sql, values);
            await hook(sql, values);
            return answer;
          },
        });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    },
  };
}
const general = (client, hook) =>
  createGeneralMessagingService(db(client, hook));
const linked = (client, hook) => createOrderMessagingService(db(client, hook));
const submit = (client, kind, hook, internalNotices = false) =>
  createMessageSubmissionService(
    db(client, hook),
    undefined,
    kind,
    internalNotices,
  );
const inbox = (client) => createMessagingInboxService(db(client), true);
const notices = (client) => createInternalNoticeService(db(client));
const send = (service, actor, conversation, n, body = "Synthetic text") =>
  service.send(actor, {
    conversation_id: conversation,
    idempotency_key: id("7c", n),
    body,
    file_ids: [],
  });
async function count(client, table, predicate = "TRUE") {
  const {
    rows: [row],
  } = await client.query(
    "SELECT count(*)::int n FROM public." + table + " WHERE " + predicate,
  );
  return row.n;
}
async function waitForLock(observer, pid) {
  for (let n = 0; n < 100; n++) {
    const {
      rows: [row],
    } = await observer.query(
      "SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",
      [pid],
    );
    if (row?.wait_event_type === "Lock") return;
    await delay(20);
  }
  throw new Error("REAL_LOCK_WAIT_NOT_OBSERVED");
}
function gate() {
  let release, entered;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  const arrival = new Promise((resolve) => {
    entered = resolve;
  });
  return { waiting, arrival, release: () => release(), enter: () => entered() };
}
try {
  equal(
    process.env.DENTAL_MESSAGING_V6_APPROVED,
    "private-unix-socket-one-shot",
  );
  equal(process.getuid(), 1002);
  const a = await connect(),
    b = await connect(),
    c = await connect(),
    observer = await connect();
  const { rows: markers } = await observer.query(
    "SELECT side,last_read_seq::int n FROM public.conversation_reads WHERE conversation_id=$1 ORDER BY side",
    [conv(1)],
  );
  equal(
    markers.map((r) => [r.side, r.n]),
    [
      ["clinic", 1],
      ["laboratory", 0],
    ],
  );
  equal(await count(observer, "conversation_reads"), 12);
  equal((await general(a).conversations(clinic, {})).result.items.length, 1);
  equal((await general(a).conversations(other, {})).result.items.length, 1);
  equal(
    (await general(a).conversations(clinic, { clinic_id: id("72", 2) })).kind,
    "denied",
  );
  equal(
    (await general(a).messages(other, { conversation_id: conv(1) })).kind,
    "denied",
  );
  equal(
    (await general(a).messages(generalOnly, { conversation_id: conv(1) })).kind,
    "result",
  );
  equal(
    (await linked(a).orderConversation(generalOnly, { order_id: order(1) }))
      .kind,
    "denied",
  );
  equal(
    (await linked(a).orderConversation(clinic, { order_id: order(2) })).kind,
    "denied",
  );
  equal(
    (await linked(a).orderConversation(clinic, { order_id: order(4) })).result
      .id,
    conv(4),
  );
  equal(
    (await linked(a).messages(other, { conversation_id: conv(4) })).kind,
    "denied",
  );
  equal(
    (await linked(a).orderConversation(clinic, { order_id: order(3) })).result
      .closed,
    true,
  );
  equal(
    (
      await inbox(a).list(both, { search: "Fixture One", kind: "order" })
    ).result.items.every((item) => item.clinic_id === id("72", 1)),
    true,
  );
  equal(
    (await inbox(a).list(generalOnly, { kind: "order" })).result.items.length,
    0,
  );
  equal(
    (await inbox(a).list(both, { kind: "order" })).result.items.some(
      (r) => r.conversation_id === conv(4),
    ),
    true,
  );
  const first = await send(
    submit(a, true, undefined, true),
    clinic,
    conv(1),
    1,
  );
  equal([first.result.kind, first.result.sequence_number], ["sent", 2]);
  for (const recipient of [account(1), generalOnly, both]) {
    const page = (await notices(a).list(recipient, {})).result;
    equal(
      [page.unread_count, page.items[0].kind, page.items[0].conversation_id],
      [1, "message_created", conv(1)],
    );
  }
  equal((await notices(a).list(clinic, {})).result.unread_count, 0);
  equal((await notices(a).list(other, {})).result.unread_count, 0);
  const staffNotice = (await notices(a).list(generalOnly, {})).result.items[0];
  equal(
    (await notices(a).markRead(generalOnly, { id: staffNotice.id })).kind,
    "result",
  );
  equal(
    (await notices(a).markRead(generalOnly, { id: staffNotice.id })).kind,
    "result",
  );
  equal((await notices(a).list(generalOnly, {})).result.unread_count, 0);
  equal((await notices(a).list(account(1), {})).result.unread_count, 1);
  equal(
    (await general(a).messages(generalOnly, { conversation_id: conv(1) }))
      .result.last_read_seq,
    0,
  );
  const replay = await send(
    submit(a, true, undefined, true),
    clinic,
    conv(1),
    1,
  );
  equal(
    [replay.result.message_id, replay.result.replayed],
    [first.result.message_id, true],
  );
  equal(
    (await send(submit(a, true), clinic, conv(1), 1, "different")).result.kind,
    "conflict",
  );
  equal((await send(submit(a, true), other, conv(1), 2)).kind, "denied");
  equal(
    (await send(submit(a, "order", undefined, true), clinic, conv(3), 3)).result
      .kind,
    "sent",
  );
  const retouchSent = await send(
    submit(a, "order", undefined, true),
    clinic,
    conv(4),
    4,
  );
  equal(retouchSent.result.kind, "sent");
  equal(
    (await notices(a).list(generalOnly, {})).result.items.some(
      (n) => n.order_id !== null,
    ),
    false,
  );
  const linkedNotices = (await notices(a).list(both, {})).result.items;
  equal(
    linkedNotices.some(
      (n) => n.order_id === order(1) && n.conversation_id === conv(3),
    ),
    true,
  );
  equal(
    linkedNotices.some(
      (n) => n.order_id === order(4) && n.conversation_id === conv(4),
    ),
    true,
  );
  const {
    rows: [initialRecipients],
  } = await observer.query(
    "SELECT count(*)::int n FROM public.internal_notifications n JOIN public.outbox_events e ON e.id=n.event_id WHERE e.aggregate_id=$1",
    [first.result.message_id],
  );
  equal(initialRecipients.n, 3);
  equal(
    (await send(submit(a, "order"), other, conv(5), 5)).result.kind,
    "sent",
  );
  equal(
    (
      await submit(a, true).send(clinic, {
        conversation_id: conv(4),
        idempotency_key: id("7c", 6),
        body: "wrong kind",
        file_ids: [],
      })
    ).kind,
    "denied",
  );
  const [sim1, sim2] = await Promise.all([
    send(submit(a, true, undefined, true), clinic, conv(1), 7),
    send(submit(b, true, undefined, true), clinicAgain, conv(1), 7),
  ]);
  equal(
    [sim1.result.message_id, sim2.result.message_id],
    [sim1.result.message_id, sim1.result.message_id],
  );
  equal([sim1.result.replayed, sim2.result.replayed].sort(), [false, true]);
  const {
    rows: [concurrentRecipients],
  } = await observer.query(
    "SELECT count(*)::int n FROM public.internal_notifications n JOIN public.outbox_events e ON e.id=n.event_id WHERE e.aggregate_id=$1",
    [sim1.result.message_id],
  );
  equal(concurrentRecipients.n, 3);
  const beforeRollback = await count(observer, "messages");
  await assert.rejects(
    send(
      submit(a, true, (sql) => {
        if (sql.startsWith("INSERT INTO public.outbox_events"))
          throw new Error("INJECT_ROLLBACK");
      }),
      clinic,
      conv(1),
      8,
    ),
    /INJECT_ROLLBACK/,
  );
  equal(await count(observer, "messages"), beforeRollback);
  equal(
    (await general(a).messages(clinic, { conversation_id: conv(1) })).result
      .last_message_seq,
    3,
  );
  for (let n = 9; n <= 64; n++) {
    const result = await send(
      submit(a, true, undefined, n === 10),
      n % 2 ? clinic : both,
      conv(1),
      n,
    );
    equal(result.result.kind, "sent");
  }
  equal((await notices(a).list(clinic, {})).result.unread_count, 1);
  const newest = (
    await general(a).messages(clinic, { conversation_id: conv(1) })
  ).result;
  equal(
    [
      newest.messages.length,
      newest.last_message_seq,
      newest.messages[0].sequence_number,
    ],
    [50, 59, 10],
  );
  const older = (
    await general(a).messages(clinic, {
      conversation_id: conv(1),
      before_seq: 10,
    })
  ).result;
  equal(
    older.messages.map((m) => m.sequence_number),
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
  const forward1 = (
    await general(a).messages(clinicAgain, {
      conversation_id: conv(1),
      after_seq: 1,
    })
  ).result;
  equal([forward1.messages.length, forward1.next_after_seq], [50, 51]);
  const forward2 = (
    await general(a).messages(clinicAgain, {
      conversation_id: conv(1),
      after_seq: forward1.next_after_seq,
    })
  ).result;
  equal(
    forward2.messages.map((m) => m.sequence_number),
    [52, 53, 54, 55, 56, 57, 58, 59],
  );
  const [readHigh, readLow] = await Promise.all([
    general(a).markRead(clinic, { conversation_id: conv(1), through_seq: 50 }),
    general(b).markRead(clinicAgain, {
      conversation_id: conv(1),
      through_seq: 40,
    }),
  ]);
  assert.ok([40, 50].includes(readLow.result.last_read_seq));
  assertions++;
  equal(readHigh.result.last_read_seq, 50);
  equal(
    (await general(a).messages(clinic, { conversation_id: conv(1) })).result
      .last_read_seq,
    50,
  );
  equal(
    (
      await general(a).markRead(clinic, {
        conversation_id: conv(1),
        through_seq: 50,
      })
    ).result.last_read_seq,
    50,
  );
  equal(
    (
      await general(a).markRead(clinic, {
        conversation_id: conv(1),
        through_seq: 60,
      })
    ).kind,
    "invalid",
  );
  equal(
    (await general(a).conversations(clinic, {})).result.items[0].unread_count >
      0,
    true,
  );
  const editable = first.result.message_id;
  const [edit, hide] = await Promise.all([
    general(a).mutate(
      clinic,
      {
        conversation_id: conv(1),
        message_id: editable,
        expected_revision: 1,
        body: "Edited",
      },
      "edit",
    ),
    general(b).mutate(
      clinicAgain,
      { conversation_id: conv(1), message_id: editable, expected_revision: 1 },
      "hide",
    ),
  ]);
  equal([edit.result.kind, hide.result.kind].sort(), ["conflict", "updated"]);
  equal(
    (
      await general(a).history(other, {
        conversation_id: conv(1),
        message_id: editable,
      })
    ).kind,
    "denied",
  );
  equal(
    (
      await general(a).history(clinic, {
        conversation_id: conv(1),
        message_id: editable,
      })
    ).kind,
    "result",
  );
  const {
    rows: [priv],
  } = await observer.query(
    "SELECT has_table_privilege('dental_lab_app','public.messages','DELETE') AS erase,has_table_privilege('dental_lab_app','public.audit_events','UPDATE') AS alter",
  );
  equal([priv.erase, priv.alter], [false, false]);
  await observer.query(
    "UPDATE public.conversations SET closed_at=statement_timestamp() WHERE id=$1",
    [conv(4)],
  );
  equal(
    (await send(submit(a, "order"), clinic, conv(4), 65)).result.kind,
    "conversation_closed",
  );
  equal(
    (await linked(a).orderConversation(clinic, { order_id: order(4) })).result
      .closed,
    true,
  );
  equal(
    (
      await linked(a).mutate(
        clinic,
        {
          conversation_id: conv(4),
          message_id: retouchSent.result.message_id,
          expected_revision: 1,
          body: "Must stay unchanged",
        },
        "edit",
      )
    ).result.kind,
    "closed",
  );
  equal((await send(submit(a, true), clinic, conv(1), 66)).result.kind, "sent");
  await observer.query(
    "UPDATE public.conversations SET closed_at=NULL WHERE id=$1",
    [conv(4)],
  );
  equal(
    (await send(submit(a, "order"), clinic, conv(4), 67)).result.kind,
    "sent",
  );
  // Hold a read transaction after authorization; revocation must wait for its grant-table lock.
  const blocker = gate();
  const held = general(a, async (sql) => {
    if (sql.startsWith("SELECT a.profile")) {
      blocker.enter();
      await blocker.waiting;
    }
  }).messages(both, { conversation_id: conv(1) });
  await blocker.arrival;
  const revoked = c.query(
    "DELETE FROM public.account_grants WHERE account_id=$1 AND permission_code IN ('messaging.general.reply','messaging.general.read')",
    [both.accountId],
  );
  try {
    await waitForLock(observer, c.processID);
  } finally {
    blocker.release();
  }
  equal((await held).kind, "result");
  await revoked;
  equal(
    (await general(a).messages(both, { conversation_id: conv(1) })).kind,
    "denied",
  );
  const revokedNotices = (await notices(a).list(both, {})).result;
  equal(
    revokedNotices.items.every((n) => n.conversation_id !== conv(1)),
    true,
  );
  equal(
    (
      await notices(a).markRead(both, {
        id: linkedNotices.find((n) => n.conversation_id === conv(1)).id,
      })
    ).kind,
    "denied",
  );
  equal(
    (await linked(a).orderConversation(both, { order_id: order(4) })).kind,
    "result",
  );
  equal(
    (await inbox(a).list(both, { kind: "general" })).result.items.length,
    0,
  );
  await observer.query("UPDATE public.clinics SET suspended=true WHERE id=$1", [
    id("72", 1),
  ]);
  equal(
    (await general(a).messages(clinic, { conversation_id: conv(1) })).kind,
    "denied",
  );
  equal((await notices(a).list(clinic, {})).kind, "denied");
  equal(
    (await linked(a).messages(clinicAgain, { conversation_id: conv(4) })).kind,
    "denied",
  );
  equal(
    (await general(a).messages(other, { conversation_id: conv(2) })).kind,
    "result",
  );
  console.log(
    JSON.stringify({
      result: "real-postgres-messaging-v6-passed",
      assertions,
      port,
      isolated: true,
    }),
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await Promise.allSettled(connections.map((client) => client.end()));
}
