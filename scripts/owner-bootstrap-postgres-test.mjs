// OPERATOR ONLY, on a disposable PostgreSQL 17 cluster, never the shared VPS DB.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { hashPassword } from "../apps/api/dist/modules/identity/index.js";
import { provisionFirstOwner } from "./owner-bootstrap-core.mjs";

const root = "/var/lib/dental-lab-bootstrap-reception";
const clients = new Set();
async function connect() {
  const client = new pg.Client({
    host: root + "/socket",
    port: 55432,
    user: "postgres",
    database: "dental_lab",
    application_name: "bootstrap-isolated-reception",
    connectionTimeoutMillis: 3000,
    query_timeout: 7000,
  });
  client.on("error", () => {});
  await client.connect();
  clients.add(client);
  const row = (
    await client.query(`SELECT current_setting('data_directory') AS directory,
    current_setting('port') AS port, pg_backend_pid() AS pid`)
  ).rows[0];
  assert.equal(row.directory, root + "/pgdata");
  assert.equal(row.port, "55432");
  return { client, pid: row.pid };
}
async function counts(client) {
  return (
    await client.query(`SELECT (SELECT count(*)::int FROM public.accounts) AS accounts,
    (SELECT count(*)::int FROM public.owner_slot) AS slots,
    (SELECT count(*)::int FROM public.credentials) AS credentials,
    (SELECT count(*)::int FROM public.audit_events WHERE process_code='owner_bootstrap') AS audits`)
  ).rows[0];
}
async function main() {
  assert.equal(
    process.env.DENTAL_LAB_BOOTSTRAP_TEST_APPROVED,
    "isolated-empty-cluster-v1",
  );
  assert.ok(![0, 1002, 994].includes(process.getuid()));
  assert.equal(process.argv.length, 2);
  const { client: observer } = await connect();
  const empty = { accounts: 0, slots: 0, credentials: 0, audits: 0 };
  assert.deepEqual(await counts(observer), empty);
  const passwordHash = await hashPassword(
    randomBytes(32).toString("base64url"),
  );
  const input = () => ({
    approval: {
      purpose: "first-owner-v1",
      approvalId: randomUUID(),
      email: randomUUID() + "@example.invalid",
      expiresAt: Date.now() + 300000,
    },
    passwordHash,
  });

  // Fault after each write, real constraint failure, and physical connection loss.
  for (const mode of [
    "account",
    "slot",
    "credential",
    "audit",
    "foreign-key",
    "connection-loss",
  ]) {
    const { client } = await connect();
    const wrapped = {
      query: async (sql, values) => {
        if (
          mode === "foreign-key" &&
          sql.startsWith("INSERT INTO public.owner_slot")
        )
          return { rows: [], rowCount: 0 };
        const result = await client.query(sql, values);
        const after = {
          account: "public.accounts",
          slot: "public.owner_slot",
          credential: "public.credentials",
          audit: "public.audit_events",
        }[mode];
        if (after && sql.startsWith("INSERT INTO " + after))
          throw new Error("INJECTED_BEFORE_COMMIT");
        if (
          mode === "connection-loss" &&
          sql.startsWith("INSERT INTO public.credentials")
        ) {
          await client.end();
          throw new Error("INJECTED_CONNECTION_LOSS");
        }
        return result;
      },
    };
    await assert.rejects(
      provisionFirstOwner(wrapped, input()),
      /^Error: BOOTSTRAP_(REFUSED_OR_ROLLED_BACK|ROLLBACK_UNCERTAIN)$/,
    );
    await client.end();
    clients.delete(client);
    assert.deepEqual(await counts(observer), empty);
  }

  // Force genuine overlap: A holds the table lock while B demonstrably waits.
  const first = await connect(),
    second = await connect();
  let release, locked;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const lockReached = new Promise((resolve) => {
    locked = resolve;
  });
  const a = provisionFirstOwner(
    {
      query: async (sql, values) => {
        const result = await first.client.query(sql, values);
        if (sql.startsWith("LOCK TABLE")) {
          locked();
          await gate;
        }
        return result;
      },
    },
    input(),
  );
  // Attach rejection handlers immediately; timeout must not leave a rejected promise unobserved.
  const aOutcome = a.then(
    (value) => ({ ok: true, value }),
    () => ({ ok: false }),
  );
  await Promise.race([
    lockReached,
    delay(7000).then(() => {
      throw new Error("LOCK_NOT_REACHED");
    }),
  ]);
  const bOutcome = provisionFirstOwner(second.client, input()).then(
    (value) => ({ ok: true, value }),
    () => ({ ok: false }),
  );
  let waiting = false;
  try {
    for (let attempt = 0; attempt < 40; attempt++) {
      const row = (
        await observer.query(
          "SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",
          [second.pid],
        )
      ).rows[0];
      if (row?.wait_event_type === "Lock") {
        waiting = true;
        break;
      }
      await delay(50);
    }
  } finally {
    release();
  }
  const results = await Promise.all([aOutcome, bOutcome]);
  assert.equal(waiting, true, "SECOND_CONNECTION_MUST_ACTUALLY_WAIT");
  assert.equal(results.filter((item) => item.ok).length, 1);
  await first.client.end();
  clients.delete(first.client);
  await second.client.end();
  clients.delete(second.client);
  // New connection, after both writers closed: real committed state, not own transaction visibility.
  const { client: fresh } = await connect();
  assert.deepEqual(await counts(fresh), {
    accounts: 1,
    slots: 1,
    credentials: 1,
    audits: 1,
  });
  await assert.rejects(
    provisionFirstOwner(fresh, input()),
    /^Error: BOOTSTRAP_REFUSED_OR_ROLLED_BACK$/,
  );
  assert.deepEqual(await counts(observer), {
    accounts: 1,
    slots: 1,
    credentials: 1,
    audits: 1,
  });
  console.log(
    JSON.stringify({
      test: "owner_bootstrap_postgres",
      result: "passed",
      scope:
        "real_commit_atomicity_rollback_connection_loss_concurrent_first_owner_and_reuse",
      fixture: "retained_in_isolated_cluster",
    }),
  );
}
try {
  await main();
} catch {
  process.stderr.write("BOOTSTRAP_RECEPTION_FAILED_INSPECT_ISOLATED_CLUSTER\n");
  process.exitCode = 1;
} finally {
  await Promise.allSettled([...clients].map((client) => client.end()));
}
