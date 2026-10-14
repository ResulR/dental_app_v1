import { assertRegistrationStorageReady } from "../../apps/api/dist/modules/clinics/registration-readiness.js";
// PREPARATION ONLY. Independent disposable VM, never the shared VPS or v1/v2/v3.
import assert from "node:assert/strict";
import os from "node:os";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { createClinicRegistrationRepository } from "../../apps/api/dist/modules/clinics/index.js";
const root = "/var/lib/dental-lab-reception-v4";
const clients = new Set();
const checks = [];
const version = "70000000-0000-4000-8000-000000000001";
async function connect() {
  const c = new pg.Client({
    host: root + "/socket",
    port: 55434,
    database: "dental_lab",
    user: "postgres",
    connectionTimeoutMillis: 3000,
    query_timeout: 10000,
  });
  c.on("error", () => {});
  await c.connect();
  clients.add(c);
  const {
    rows: [r],
  } = await c.query(
    "SELECT current_database() db,current_setting('data_directory') dir,current_setting('port') port,current_setting('server_version_num')::int version,pg_backend_pid() pid",
  );
  assert.equal(r.db, "dental_lab");
  assert.equal(r.dir, root + "/pgdata");
  assert.equal(r.port, "55434");
  assert.ok(r.version >= 170000 && r.version < 180000);
  await c.query(
    "SET statement_timeout='8s'; SET lock_timeout='6s'; SET idle_in_transaction_session_timeout='12s'",
  );
  return { c, pid: r.pid };
}
function store(c, hook = async () => {}) {
  return createClinicRegistrationRepository({
    query: (sql, values) => c.query(sql, values),
    transaction: async (work) => {
      await c.query("BEGIN; SET LOCAL ROLE dental_lab_app");
      try {
        const result = await work({
          query: async (sql, values) => {
            const result = await c.query(sql, values);
            await hook(sql);
            return result;
          },
        });
        await c.query("COMMIT");
        return result;
      } catch (error) {
        await c.query("ROLLBACK");
        throw error;
      }
    },
  });
}
function data(email) {
  return {
    name: "Synthetic clinic",
    dentist_first_name: "Fixture",
    dentist_last_name: "Only",
    email,
    email_key: email,
    phone: "+000",
    address: "Fixture only",
    password_hash: "not-a-real-login-hash",
    terms_version_id: version,
    profile: "clinic",
    review_state: "pending",
  };
}
async function blocked(observer, pid) {
  for (let i = 0; i < 100; i++) {
    const {
      rows: [r],
    } = await observer.query(
      "SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",
      [pid],
    );
    if (r?.wait_event_type === "Lock") return;
    await delay(20);
  }
  throw new Error("EXPECTED_REAL_LOCK_WAIT");
}
async function denied(c, sql, wanted = "42501") {
  await c.query("SAVEPOINT refusal");
  let code;
  try {
    await c.query(sql);
  } catch (error) {
    code = error.code;
  }
  await c.query("ROLLBACK TO SAVEPOINT refusal; RELEASE SAVEPOINT refusal");
  assert.equal(code, wanted);
}
try {
  assert.equal(
    process.env.DENTAL_RECEPTION_V4_APPROVED,
    "independent-empty-vm",
  );
  assert.ok(!os.hostname().startsWith("vps-28bf7789"));
  assert.ok(![0, 1002, 991, 992, 993, 994].includes(process.getuid()));
  const { c: observer } = await connect();
  const {
    rows: [initial],
  } = await observer.query(
    "SELECT (SELECT count(*) FROM public.clinics)::int clinics,(SELECT count(*) FROM public.catalog_references)::int catalog",
  );
  assert.deepEqual(initial, { clinics: 0, catalog: 0 });
  // The exact frozen catalogue recipe is reused as data, in this independent DB only.
  await observer.query("BEGIN; SET LOCAL ROLE dental_lab_migrator");
  const notices = [];
  observer.on("notice", (notice) => notices.push(notice.message));
  await observer.query(
    await readFile(
      new URL("../migrations/catalog_constraints.sql", import.meta.url),
      "utf8",
    ),
  );
  await observer.query("ROLLBACK");
  assert.ok(notices.some((n) => n.includes("15 negative cases")));
  assert.equal(
    (
      await observer.query(
        "SELECT count(*)::int n FROM public.catalog_references",
      )
    ).rows[0].n,
    0,
  );
  checks.push("catalog_15_refusals_history_rollback");
  // Every write failure is rolled back; retained successful cases use unique fixtures.
  const tables = [
    "accounts",
    "clinics",
    "credentials",
    "clinic_terms_acceptances",
    "conversations",
    "audit_events",
    "outbox_events",
    "outbox_dispatches",
  ];
  for (const table of tables) {
    const { c } = await connect();
    const email = table + "@example.invalid";
    const repo = store(c, async (sql) => {
      if (sql.startsWith("INSERT INTO public." + table + "("))
        throw new Error("INJECTED");
    });
    await assert.rejects(repo.registerAtomic(data(email)), /INJECTED/);
    assert.equal(
      (
        await observer.query(
          "SELECT count(*)::int n FROM public.accounts WHERE email_key=$1",
          [email],
        )
      ).rows[0].n,
      0,
    );
    await c.end();
    clients.delete(c);
  }
  checks.push("eight_write_failures_rollback");
  const a = await connect(),
    b = await connect();
  let unlock, entered;
  const held = new Promise((resolve) => {
    entered = resolve;
  });
  const release = new Promise((resolve) => {
    unlock = resolve;
  });
  const first = store(a.c, async (sql) => {
    if (sql.startsWith("INSERT INTO public.accounts")) {
      entered();
      await release;
    }
  }).registerAtomic(data("race@example.invalid"));
  await held;
  const second = store(b.c).registerAtomic(data("race@example.invalid"));
  await blocked(observer, b.pid);
  unlock();
  assert.equal(await first, "created");
  assert.equal(await second, "duplicate");
  checks.push("email_concurrency_unique");
  const lock = await connect(),
    publisher = await connect();
  await lock.c.query(
    "BEGIN; SET LOCAL ROLE dental_lab_app; SELECT version_id FROM public.registration_current_terms WHERE singleton=1 FOR SHARE",
  );
  const publication = publisher.c.query(
    "UPDATE public.registration_current_terms SET version_id='70000000-0000-4000-8000-000000000002' WHERE singleton=1",
  );
  await blocked(observer, publisher.pid);
  await lock.c.query("ROLLBACK");
  await publication;
  assert.equal(
    await store(lock.c).registerAtomic(data("obsolete@example.invalid")),
    "terms_changed",
  );
  checks.push("publication_blocked_then_stale_consent_refused");
  await lock.c.query("BEGIN; SET LOCAL ROLE dental_lab_app");
  await assertRegistrationStorageReady({
    query: (sql, values) => lock.c.query(sql, values),
  });
  await denied(
    lock.c,
    "INSERT INTO public.registration_terms_versions DEFAULT VALUES",
  );
  await denied(lock.c, "DELETE FROM public.registration_current_terms");
  await denied(
    lock.c,
    "UPDATE public.registration_current_terms SET singleton=2",
    "23514",
  );
  await denied(
    lock.c,
    "UPDATE public.registration_current_terms SET version_id=version_id",
  );
  await denied(
    lock.c,
    "UPDATE public.registration_terms_versions SET body='invalid'",
  );
  await denied(lock.c, "DELETE FROM public.clinic_terms_acceptances");
  await denied(
    lock.c,
    "UPDATE public.clinic_terms_acceptances SET accepted_at=CURRENT_TIMESTAMP",
  );
  await lock.c.query("ROLLBACK");
  checks.push("app_privilege_refusals");
  const {
    rows: [state],
  } = await observer.query(
    "SELECT (SELECT count(*) FROM public.clinics)::int clinics,(SELECT count(*) FROM public.clinic_terms_acceptances)::int acceptances,(SELECT count(*) FROM public.conversations)::int conversations,(SELECT count(*) FROM public.outbox_events WHERE type='clinic_registered')::int events",
  );
  assert.deepEqual(state, {
    clinics: 1,
    acceptances: 1,
    conversations: 1,
    events: 1,
  });
  console.log(
    JSON.stringify({
      result: "passed",
      test: "catalog_registration_v4",
      checks,
      state,
      fixtures: "retained",
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      result: "failed",
      checks,
      code: error.code,
      message: error.message,
    }),
  );
  process.exitCode = 1;
} finally {
  await Promise.allSettled([...clients].map((c) => c.end()));
}
