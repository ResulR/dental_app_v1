// PROPOSAL ONLY: isolated synthetic v13, never production and never auto-run.
import assert from "node:assert/strict";
import pg from "pg";
import { createDormantDeliveryRepository } from "../../apps/api/dist/modules/notifications/dormant-delivery.repository.js";
import { runOneSyntheticDelivery } from "../../apps/api/dist/modules/notifications/dormant-delivery.worker.js";

const root = "/srv/dental-lab/.local/notifications-v13";
const id = (prefix, n) =>
  prefix + "000000-0000-4000-8000-" + String(n).padStart(12, "0");
const clients = [];
let assertions = 0;
function eq(actual, expected) {
  assert.deepEqual(actual, expected);
  assertions++;
}
async function connect() {
  const client = new pg.Client({
    host: root + "/socket",
    port: 55443,
    user: "postgres",
    database: "dental_lab",
    connectionTimeoutMillis: 3000,
    query_timeout: 9000,
  });
  client.on("error", () => {});
  await client.connect();
  clients.push(client);
  const {
    rows: [row],
  } = await client.query(
    "SELECT current_database() db,current_setting('data_directory') dir,current_setting('port') port",
  );
  eq([row.db, row.dir, row.port], ["dental_lab", root + "/pgdata", "55443"]);
  return client;
}
function app(client) {
  return {
    transaction: async (work) => {
      await client.query("BEGIN");
      try {
        await client.query("SET LOCAL ROLE dental_lab_app");
        await client.query("SET LOCAL statement_timeout='8s'");
        await client.query("SET LOCAL lock_timeout='3s'");
        const result = await work({
          query: (sql, values) => client.query(sql, values),
        });
        await client.query("COMMIT");
        return result;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    },
  };
}
async function expectPrivilegeDenied(client, sql) {
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL ROLE dental_lab_app");
    let code;
    try {
      await client.query(sql);
    } catch (error) {
      code = error.code;
    }
    eq(code, "42501");
  } finally {
    await client.query("ROLLBACK");
  }
}
async function insertIntent(
  admin,
  eventNumber,
  type,
  orderNumber,
  clinicNumber,
  actorNumber,
  targetNumber,
) {
  const event = id("80", eventNumber);
  await admin.query(
    `INSERT INTO public.outbox_events
     (id,type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,actor_id,correlation_id)
     SELECT $1,$2,'order',o.id,o.revision,o.clinic_id,$3,$4
     FROM public.orders o WHERE o.id=$5 AND o.clinic_id=$6`,
    [
      event,
      type,
      id("71", actorNumber),
      id("81", eventNumber),
      id("75", orderNumber),
      id("72", clinicNumber),
    ],
  );
  const {
    rows: [delivery],
  } = await admin.query(
    `INSERT INTO public.notification_deliveries(event_id,target_account_id,channel,purpose)
     VALUES($1,$2,'email','business') RETURNING id`,
    [event, id("71", targetNumber)],
  );
  return delivery.id;
}
async function state(admin, delivery) {
  const {
    rows: [row],
  } = await admin.query(
    "SELECT state,attempt_count,lease_id,provider_id,cancellation_code FROM public.notification_deliveries WHERE id=$1",
    [delivery],
  );
  return row;
}
async function run() {
  const admin = await connect(),
    a = await connect(),
    b = await connect();
  const queueA = createDormantDeliveryRepository(app(a));
  const queueB = createDormantDeliveryRepository(app(b));
  await expectPrivilegeDenied(
    admin,
    "UPDATE public.notification_attempts SET result='provider_accepted'",
  );
  await expectPrivilegeDenied(
    admin,
    "UPDATE public.email_category_recipients SET changed_by=NULL",
  );
  await expectPrivilegeDenied(
    admin,
    "UPDATE public.notification_deliveries SET target_account_id=NULL",
  );
  const first = await insertIntent(admin, 1, "order_submitted", 5, 2, 3, 1);
  const adminTarget = await insertIntent(
    admin,
    2,
    "modification_requested",
    6,
    2,
    3,
    5,
  );
  // Grant both current rights and category; fixture already has logistics.
  await admin.query(
    `INSERT INTO public.account_grants
    (account_id,account_profile,permission_code,prerequisite_key,created_by)
    SELECT $1,'admin',p.code,p.prerequisite_key,$2 FROM public.permission_definitions p
    WHERE p.code='orders.read_details'`,
    [id("71", 5), id("71", 1)],
  );
  await admin.query(
    `INSERT INTO public.email_category_recipients
    (category,account_id,changed_by) VALUES('modification_requested',$1,$2)`,
    [id("71", 5), id("71", 1)],
  );
  const lease = await queueA.claim();
  eq(lease.id, first);
  // A concurrently locked delivery must be skipped by the second worker.
  await a.query("BEGIN");
  try {
    await a.query(
      "SELECT id FROM public.notification_deliveries WHERE id=$1 FOR UPDATE",
      [first],
    );
    const other = await queueB.claim();
    eq(other.id, adminTarget);
    eq(await queueB.preflight(other), "eligible");
    await admin.query(
      `DELETE FROM public.email_category_recipients
      WHERE category='modification_requested' AND account_id=$1`,
      [id("71", 5)],
    );
    // A second preflight on the same lease observes the revoked configuration.
    eq(await queueB.preflight(other), "cancelled");
    eq((await state(admin, adminTarget)).state, "cancelled");
  } finally {
    await a.query("ROLLBACK");
  }
  eq(await queueA.preflight(lease), "eligible");
  eq(await queueA.settle(lease, "temporary_error"), true);
  eq((await state(admin, first)).state, "pending");
  eq(
    (
      await admin.query(
        "SELECT result FROM public.notification_attempts WHERE delivery_id=$1",
        [first],
      )
    ).rows[0].result,
    "temporary_error",
  );
  eq(await queueA.claim(), null); // backoff prevents an immediate retry
  // Advance only the synthetic clock position of this delivery as fixture owner.
  await admin.query(
    "UPDATE public.notification_deliveries SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [first],
  );
  const retry = await queueA.claim();
  eq([retry.id, retry.attempt_count], [first, 2]);
  eq(await queueA.preflight(retry), "eligible");
  eq(await queueA.settle(retry, "provider_accepted", "fake:accepted"), true);
  eq((await state(admin, first)).state, "provider_accepted");
  eq(
    (
      await admin.query(
        "SELECT count(*)::int n FROM public.notification_attempts WHERE delivery_id=$1",
        [first],
      )
    ).rows[0].n,
    2,
  );
  eq(await queueA.claim(), null);

  const clinicTarget = await insertIntent(
    admin,
    3,
    "order_accepted",
    7,
    2,
    1,
    3,
  );
  const expired = await queueA.claim();
  eq(expired.id, clinicTarget);
  await admin.query(
    "UPDATE public.notification_deliveries SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
    [clinicTarget],
  );
  eq(await queueB.recoverExpired(), true);
  eq((await state(admin, clinicTarget)).state, "failed");
  eq(
    (
      await admin.query(
        "SELECT result,error_code FROM public.notification_attempts WHERE delivery_id=$1",
        [clinicTarget],
      )
    ).rows[0],
    { result: "ambiguous", error_code: "LEASE_EXPIRED" },
  );
  eq(await queueA.settle(expired, "provider_accepted", "fake:late"), false);
  eq(await queueA.claim(), null);

  const stale = await insertIntent(
    admin,
    4,
    "instructions_changed",
    7,
    2,
    1,
    3,
  );
  await admin.query(
    "UPDATE public.orders SET revision=revision+1 WHERE id=$1",
    [id("75", 7)],
  );
  const staleLease = await queueA.claim();
  eq(staleLease.id, stale);
  eq(await queueA.preflight(staleLease), "cancelled");
  eq((await state(admin, stale)).state, "cancelled");
  const revoked = await insertIntent(admin, 6, "order_accepted", 7, 2, 1, 3);
  await admin.query(
    "UPDATE public.accounts SET lifecycle='suspended' WHERE id=$1",
    [id("71", 3)],
  );
  const revokedLease = await queueA.claim();
  eq(revokedLease.id, revoked);
  eq(await queueA.preflight(revokedLease), "cancelled");
  eq((await state(admin, revoked)).state, "cancelled");
  await admin.query(
    "UPDATE public.accounts SET lifecycle='active' WHERE id=$1",
    [id("71", 3)],
  );

  // Fake transport is invoked only after preflight. It never sees an address.
  const fresh = await insertIntent(admin, 5, "order_submitted", 6, 2, 3, 1);
  let called = 0;
  eq(
    await runOneSyntheticDelivery(queueA, async (reserved) => {
      eq(reserved.id, fresh);
      called++;
      return { outcome: "ambiguous" };
    }),
    "ambiguous",
  );
  eq(called, 1);
  eq((await state(admin, fresh)).state, "failed");
  eq(await queueA.claim(), null);
  console.log(
    JSON.stringify({
      result: "real-postgres-dormant-delivery-v13-passed",
      assertions,
    }),
  );
}
try {
  await run();
} finally {
  await Promise.all(clients.map((c) => c.end()));
}
