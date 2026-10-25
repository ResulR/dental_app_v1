// PROPOSAL ONLY. Run only through the separately approved isolated v10 runner.
import assert from "node:assert/strict";
import pg from "pg";
import { createMessageSubmissionService } from "../../apps/api/dist/modules/messaging/index.js";
import { createInternalNoticeService } from "../../apps/api/dist/modules/notifications/index.js";
import {
  appendClinicalMailIntent,
  createClinicalMailIntentRepository,
} from "../../apps/api/dist/modules/notifications/clinical-mail-intent.repository.js";
import { createLaboratoryOrderMailIntentRepository } from "../../apps/api/dist/modules/notifications/laboratory-mail-intent.repository.js";

const root = "/srv/dental-lab/.local/notifications-v10",
  port = 55440;
const id = (p, n) => p + "000000-0000-4000-8000-" + String(n).padStart(12, "0");
const actor = (n) => ({ accountId: id("71", n), sessionId: id("77", n) });
const clinic = actor(2),
  owner = actor(1),
  admin = actor(5);
const order = (n) => id("75", n),
  conv = id("79", 1);
const clients = [];
let assertions = 0;
const eq = (a, b) => {
  assert.deepEqual(a, b);
  assertions++;
};
async function connect() {
  const c = new pg.Client({
    host: root + "/socket",
    port,
    user: "postgres",
    database: "dental_lab",
    connectionTimeoutMillis: 3000,
    query_timeout: 9000,
  });
  c.on("error", () => {});
  await c.connect();
  clients.push(c);
  const {
    rows: [r],
  } = await c.query(
    "SELECT current_database() db,current_setting('data_directory') dir,current_setting('port') port,current_setting('server_version_num')::int version",
  );
  eq([r.db, r.dir, r.port], ["dental_lab", root + "/pgdata", String(port)]);
  assert.ok(r.version >= 170000 && r.version < 180000);
  assertions++;
  return c;
}
function db(c, hook = async () => {}) {
  return {
    transaction: async (work) => {
      await c.query("BEGIN");
      try {
        await c.query("SET LOCAL ROLE dental_lab_app");
        await c.query("SET LOCAL statement_timeout='8s'");
        await c.query("SET LOCAL lock_timeout='4s'");
        const result = await work({
          query: async (sql, args) => {
            const response = await c.query(sql, args);
            await hook(sql);
            return response;
          },
        });
        await c.query("COMMIT");
        return result;
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      }
    },
  };
}
// Each probe rolls back even when an unexpected privilege is present.
async function expectPrivilegeDenied(c, sql) {
  await c.query("BEGIN");
  try {
    await c.query("SET LOCAL ROLE dental_lab_app");
    let error;
    try {
      await c.query(sql);
    } catch (e) {
      error = e;
    }
    eq(error?.code, "42501");
  } finally {
    await c.query("ROLLBACK");
  }
}
async function count(c, table, event) {
  const {
    rows: [r],
  } = await c.query(
    "SELECT count(*)::int n FROM public." + table + " WHERE event_id=$1",
    [event],
  );
  return r.n;
}
async function event(
  c,
  n,
  type,
  orderId,
  revision,
  clinicId,
  actorId = owner.accountId,
) {
  const eid = id("8e", n);
  await c.query(
    "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,actor_id,correlation_id) VALUES($1,$2,'order',$3,$4,$5,$6,$7)",
    [eid, type, orderId, revision, clinicId, actorId, id("8f", n)],
  );
  await c.query("INSERT INTO public.outbox_dispatches(event_id) VALUES($1)", [
    eid,
  ]);
  return eid;
}
try {
  const a = await connect(),
    b = await connect(),
    c = await connect();
  // The app can read owner_slot, but must never gain a row lock or mutation
  // privilege on it. Other protected columns remain read-only as well.
  for (const sql of [
    "SELECT singleton FROM public.owner_slot WHERE singleton=1 FOR SHARE",
    "UPDATE public.owner_slot SET account_id=account_id WHERE singleton=1",
    "DELETE FROM public.owner_slot WHERE singleton=1",
    "UPDATE public.account_grants SET permission_code=permission_code WHERE false",
    "SELECT account_id FROM public.account_grants FOR SHARE",
    "UPDATE public.sessions SET account_id=account_id WHERE false",
    "UPDATE public.email_category_recipients SET category=category WHERE false",
    "UPDATE public.internal_notifications SET target_account_id=target_account_id WHERE false",
    "DELETE FROM public.internal_notifications WHERE false",
    "UPDATE public.outbox_events SET type=type WHERE false",
  ])
    await expectPrivilegeDenied(c, sql);
  const {
    rows: [seeded],
  } = await c.query(
    `SELECT o.status,o.revision::int revision,
       o.current_version_id=o.manufacturing_version_id matched,
       v.id IS NOT NULL version_exists,l.source_revision::int source_revision
     FROM public.orders o
     JOIN public.order_versions v ON v.order_id=o.id AND v.id=o.manufacturing_version_id
     JOIN public.work_links l ON l.source_order_id=o.id
     WHERE o.id=$1`,
    [order(3)],
  );
  eq(seeded, {
    status: "delivered",
    revision: 4,
    matched: true,
    version_exists: true,
    source_revision: 4,
  });
  const notice = createInternalNoticeService(db(a));
  const send = createMessageSubmissionService(db(a), undefined, true, true);
  for (let n = 100; n < 151; n++) {
    const result = await send.send(clinic, {
      conversation_id: conv,
      idempotency_key: id("7c", n),
      body: "Synthetic message " + n,
      file_ids: [],
    });
    eq(result.result.kind, "sent");
  }
  const first = (await notice.list(owner, {})).result;
  eq(first.items.length, 50);
  eq(first.unread_count, 51);
  assert.ok(first.next_before_id && first.next_before_at);
  assertions++;
  const second = (
    await notice.list(owner, {
      before_at: first.next_before_at,
      before_id: first.next_before_id,
    })
  ).result;
  eq(second.items.length, 1);
  eq(new Set([...first.items, ...second.items].map((x) => x.id)).size, 51);
  const firstRead = await notice.markRead(owner, { id: first.items[0].id });
  const replayRead = await notice.markRead(owner, { id: first.items[0].id });
  eq(firstRead.result.read_at, replayRead.result.read_at);
  eq((await notice.list(owner, {})).result.unread_count, 50);
  eq(
    (await createInternalNoticeService(db(b)).list(admin, {})).result
      .unread_count,
    51,
  );
  eq(
    (
      await createInternalNoticeService(db(b)).markRead(actor(3), {
        id: first.items[0].id,
      })
    ).kind,
    "denied",
  );
  const {
    rows: [read],
  } = await c.query(
    "SELECT last_read_seq FROM public.conversation_reads WHERE conversation_id=$1 AND side='laboratory'",
    [conv],
  );
  eq(Number(read.last_read_seq), 0);

  // A grant removal waits for a message producer's authorization and notice insert.
  let entered, release;
  const arrived = new Promise((resolve) => {
    entered = resolve;
  });
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const producing = createMessageSubmissionService(
    db(b, async (sql) => {
      if (sql.startsWith("SELECT a.profile")) {
        entered();
        await held;
      }
    }),
    undefined,
    true,
    true,
  ).send(clinic, {
    conversation_id: conv,
    idempotency_key: id("7c", 151),
    body: "Concurrent synthetic message",
    file_ids: [],
  });
  await arrived;
  const revoke = c.query(
    "DELETE FROM public.account_grants WHERE account_id=$1 AND permission_code IN ('messaging.general.reply','messaging.general.read')",
    [admin.accountId],
  );
  try {
    let locked = false;
    for (let n = 0; n < 80; n++) {
      const {
        rows: [r],
      } = await a.query(
        "SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",
        [c.processID],
      );
      if (r.wait_event_type === "Lock") {
        locked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    eq(locked, true);
  } finally {
    release();
  }
  const concurrentMessage = await producing;
  eq(concurrentMessage.result.kind, "sent");
  await revoke;
  const {
    rows: [recipientCount],
  } = await c.query(
    "SELECT count(*)::int n FROM public.internal_notifications n JOIN public.outbox_events e ON e.id=n.event_id WHERE e.aggregate_id=$1",
    [concurrentMessage.result.message_id],
  );
  eq(recipientCount.n, 3);
  eq(
    (await createInternalNoticeService(db(b)).list(admin, {})).result
      .unread_count,
    0,
  );

  const clinicalEvent = await event(
    c,
    1,
    "order_accepted",
    order(1),
    1,
    id("72", 1),
  );
  const clinicalA = createClinicalMailIntentRepository(db(a));
  const clinicalB = createClinicalMailIntentRepository(db(b));
  eq(
    (
      await Promise.all([
        clinicalA.prepare(clinicalEvent),
        clinicalB.prepare(clinicalEvent),
      ])
    ).sort(),
    ["prepared", "skipped"],
  );
  eq(await count(c, "notification_deliveries", clinicalEvent), 1);
  const rollbackEvent = await event(
    c,
    6,
    "order_accepted",
    order(2),
    1,
    id("72", 2),
  );
  await assert.rejects(
    db(a).transaction(async (tx) => {
      eq(await appendClinicalMailIntent(tx, rollbackEvent), "prepared");
      throw Error("SYNTHETIC_ROLLBACK");
    }),
    /SYNTHETIC_ROLLBACK/,
  );
  eq(await count(c, "notification_deliveries", rollbackEvent), 0);
  eq(await clinicalA.prepare(rollbackEvent), "prepared");
  eq(await count(c, "notification_deliveries", rollbackEvent), 1);
  await c.query(
    "UPDATE public.orders SET revision=2,status='completed',manufacturing_version_id=current_version_id WHERE id=$1",
    [order(1)],
  );
  eq(await clinicalA.prepare(clinicalEvent), "skipped");
  const newerEvent = await event(
    c,
    2,
    "order_completed",
    order(1),
    2,
    id("72", 1),
  );
  await c.query("UPDATE public.clinics SET suspended=true WHERE id=$1", [
    id("72", 1),
  ]);
  eq(await clinicalA.prepare(newerEvent), "skipped");
  eq(await count(c, "notification_deliveries", newerEvent), 0);

  // Configured administrator requires the current prerequisite and detail grants.
  await c.query(
    "INSERT INTO public.account_grants(account_id,account_profile,permission_code,prerequisite_key,created_by) SELECT $1,'admin',p.code,p.prerequisite_key,$2 FROM public.permission_definitions p WHERE p.code='orders.read_details'",
    [admin.accountId, owner.accountId],
  );
  await c.query(
    "INSERT INTO public.email_category_recipients(category,account_id,changed_by) VALUES('order_submitted',$1,$2)",
    [admin.accountId, owner.accountId],
  );
  const labEvent = await event(
    c,
    3,
    "order_submitted",
    order(5),
    1,
    id("72", 2),
    actor(3).accountId,
  );
  const labA = createLaboratoryOrderMailIntentRepository(db(a));
  const labB = createLaboratoryOrderMailIntentRepository(db(b));
  const laboratoryProposal = await event(
    c,
    5,
    "modification_requested",
    order(5),
    1,
    id("72", 2),
    owner.accountId,
  );
  eq(await labA.prepare(laboratoryProposal), "skipped");
  eq(await count(c, "notification_deliveries", laboratoryProposal), 0);
  eq(
    (
      await Promise.all([labA.prepare(labEvent), labB.prepare(labEvent)])
    ).sort(),
    ["prepared", "skipped"],
  );
  eq(await count(c, "notification_deliveries", labEvent), 2);
  await c.query(
    "DELETE FROM public.account_grants WHERE account_id=$1 AND permission_code='orders.read_details'",
    [admin.accountId],
  );
  const labNext = await event(
    c,
    4,
    "order_submitted",
    order(6),
    1,
    id("72", 2),
    actor(3).accountId,
  );
  eq(await labA.prepare(labNext), "prepared");
  eq(await count(c, "notification_deliveries", labNext), 1);
  // A revision update must wait for the intent's order lock. Once committed,
  // a subsequent prepare of the old event must not create a second intent.
  const racingEvent = await event(
    c,
    7,
    "order_accepted",
    order(2),
    1,
    id("72", 2),
  );
  let releaseOrder, enteredOrder;
  const orderEntered = new Promise((resolve) => {
    enteredOrder = resolve;
  });
  const orderHeld = new Promise((resolve) => {
    releaseOrder = resolve;
  });
  const preparingOrder = createClinicalMailIntentRepository(
    db(a, async (sql) => {
      if (sql.includes("FOR SHARE OF o")) {
        enteredOrder();
        await orderHeld;
      }
    }),
  ).prepare(racingEvent);
  await orderEntered;
  const revise = c.query("UPDATE public.orders SET revision=2 WHERE id=$1", [
    order(2),
  ]);
  try {
    let waiting = false;
    for (let n = 0; n < 80; n++) {
      const {
        rows: [r],
      } = await b.query(
        "SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",
        [c.processID],
      );
      if (r.wait_event_type === "Lock") {
        waiting = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    eq(waiting, true);
  } finally {
    releaseOrder();
  }
  eq(await preparingOrder, "prepared");
  await revise;
  eq(await clinicalA.prepare(racingEvent), "skipped");
  eq(await count(c, "notification_deliveries", racingEvent), 1);

  // Regrant the admin for another category. Account suspension (a row the
  // app can lock) waits; grant/config deletion is not claimed to wait.
  await c.query(
    "INSERT INTO public.account_grants(account_id,account_profile,permission_code,prerequisite_key,created_by) SELECT $1,'admin',p.code,p.prerequisite_key,$2 FROM public.permission_definitions p WHERE p.code='orders.read_details'",
    [admin.accountId, owner.accountId],
  );
  await c.query(
    "INSERT INTO public.email_category_recipients(category,account_id,changed_by) VALUES('cancellation_requested',$1,$2)",
    [admin.accountId, owner.accountId],
  );
  const racingLab = await event(
    c,
    8,
    "cancellation_requested",
    order(6),
    1,
    id("72", 2),
    actor(3).accountId,
  );
  let releaseGrant, enteredGrant;
  const grantEntered = new Promise((resolve) => {
    enteredGrant = resolve;
  });
  const grantHeld = new Promise((resolve) => {
    releaseGrant = resolve;
  });
  const preparingLab = createLaboratoryOrderMailIntentRepository(
    db(a, async (sql) => {
      if (
        sql.includes("FROM public.email_category_recipients r") &&
        sql.includes("FOR SHARE OF a")
      ) {
        enteredGrant();
        await grantHeld;
      }
    }),
  ).prepare(racingLab);
  await grantEntered;
  const suspendAdmin = c.query(
    "UPDATE public.accounts SET security_locked=true WHERE id=$1",
    [admin.accountId],
  );
  try {
    let waiting = false;
    for (let n = 0; n < 80; n++) {
      const {
        rows: [r],
      } = await b.query(
        "SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",
        [c.processID],
      );
      if (r.wait_event_type === "Lock") {
        waiting = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    eq(waiting, true);
  } finally {
    releaseGrant();
  }
  eq(await preparingLab, "prepared");
  await suspendAdmin;
  eq(await count(c, "notification_deliveries", racingLab), 2);
  const afterSuspension = await event(
    c,
    9,
    "cancellation_requested",
    order(5),
    1,
    id("72", 2),
    actor(3).accountId,
  );
  eq(await labA.prepare(afterSuspension), "prepared");
  eq(await count(c, "notification_deliveries", afterSuspension), 1);
  eq(await labA.prepare(racingLab), "skipped");
  console.log(
    JSON.stringify({
      result: "real-postgres-notification-outbox-v10-passed",
      assertions,
    }),
  );
} finally {
  await Promise.allSettled(clients.map((c) => c.end()));
}
