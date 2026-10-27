// PREPARATION ONLY. The runner requires a separate explicit approval.
import assert from "node:assert/strict";
import pg from "pg";
const root = "/srv/dental-lab/.local/order-similarity-v1";
const { createOrderSimilarityService } = await import(
  root + "/source/apps/api/dist/modules/orders/similarity.service.js"
);
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
    port: 55448,
    user: "postgres",
    database: "dental_lab",
    connectionTimeoutMillis: 3000,
    query_timeout: 9000,
  });
  client.on("error", () => {});
  await client.connect();
  clients.push(client);
  const {
    rows: [identity],
  } = await client.query(
    "SELECT current_database() db,current_setting('data_directory') dir,current_setting('port') port",
  );
  eq(
    [identity.db, identity.dir, identity.port],
    ["dental_lab", root + "/pgdata", "55448"],
  );
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
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    },
  };
}
const actor = (n) => ({ accountId: id("a1", n), sessionId: id("a7", n) });
const input = {
  patient: {
    internal_reference: "REF-X",
    first_name: "Mira",
    last_name: "Test",
  },
  requested_delivery_date: "2026-11-01",
  material_id: id("a3", 1),
  shade_id: id("a3", 2),
  teeth: [],
  file_ids: [],
};
let admin;
try {
  admin = await connect();
  const clinic = await connect();
  const service = createOrderSimilarityService(app(clinic));
  const {
    rows: [before],
  } = await admin.query("SELECT count(*)::integer AS n FROM public.orders");
  const first = await service.check(actor(1), input);
  eq(first.kind, "checked");
  eq(
    first.result.matches.map((x) => x.order_id),
    [id("a5", 4), id("a5", 3), id("a5", 2)],
  );
  eq(
    first.result.matches.map((x) => x.signal),
    [
      "same_reference_and_work",
      "same_reference_and_work",
      "same_name_and_work",
    ],
  );
  eq(JSON.stringify(first.result).includes("Mira"), false);
  eq(JSON.stringify(first.result).includes("REF-X"), false);
  const foreign = await service.check(actor(2), input);
  eq(
    foreign.result.matches.map((x) => x.order_id),
    [id("a5", 5)],
  );
  eq(await service.check(actor(3), input), { kind: "denied" });
  eq(await service.check({ ...actor(1), sessionId: id("a7", 2) }, input), {
    kind: "denied",
  });
  await admin.query(
    "UPDATE public.sessions SET revoked_at=clock_timestamp() WHERE id=$1",
    [id("a7", 1)],
  );
  eq(await service.check(actor(1), input), { kind: "denied" });
  await admin.query("UPDATE public.sessions SET revoked_at=NULL WHERE id=$1", [
    id("a7", 1),
  ]);
  eq(
    (
      await service.check(actor(1), {
        ...input,
        patient: { internal_reference: "ABSENT" },
      })
    ).result.matches,
    [],
  );
  await admin.query(
    "UPDATE public.orders SET current_version_id=$1 WHERE id=$2",
    [id("a6", 70), id("a5", 7)],
  );
  eq(
    (await service.check(actor(1), input)).result.matches.map(
      (x) => x.order_id,
    ),
    [id("a5", 7), id("a5", 4), id("a5", 3)],
  );
  await admin.query(
    "UPDATE public.orders SET current_version_id=$1 WHERE id=$2",
    [id("a6", 7), id("a5", 7)],
  );
  await admin.query("UPDATE public.clinics SET suspended=true WHERE id=$1", [
    id("a2", 1),
  ]);
  eq(await service.check(actor(1), input), { kind: "denied" });
  await admin.query("UPDATE public.clinics SET suspended=false WHERE id=$1", [
    id("a2", 1),
  ]);
  await clinic.query("BEGIN");
  let denied;
  try {
    await clinic.query("SET LOCAL ROLE dental_lab_app");
    await clinic.query(
      "INSERT INTO public.owner_slot(singleton,account_id) VALUES(1,$1)",
      [id("a1", 1)],
    );
  } catch (error) {
    denied = error.code;
  } finally {
    await clinic.query("ROLLBACK");
  }
  eq(denied, "42501");
  const {
    rows: [after],
  } = await admin.query("SELECT count(*)::integer AS n FROM public.orders");
  eq(after.n, before.n);
  console.log(
    JSON.stringify({
      result: "real-postgres-order-similarity-v1-passed",
      assertions,
      orders_unchanged: true,
      private_scope: true,
    }),
  );
} finally {
  await Promise.allSettled(clients.map((client) => client.end()));
}
