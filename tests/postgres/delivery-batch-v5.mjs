// PREPARATION ONLY. PostgreSQL 17 on the private v5 Unix socket; no production connection.
import assert from "node:assert/strict";
import pg from "pg";
import { setTimeout as delay } from "node:timers/promises";
import { createDeliveryBatchService } from "../../apps/api/dist/modules/orders/index.js";
const root = "/srv/dental-lab/.local/delivery-batch-v5",
  port = 55435;
const id = (prefix, n) =>
  prefix + "000000-0000-4000-8000-" + String(n).padStart(12, "0");
const owner = { accountId: id("71", 1), sessionId: id("77", 1) };
const clinic = { accountId: id("71", 2), sessionId: id("77", 2) };
const receipt = (n) => id("78", n);
const item = (n, mode = "clinic_pickup") => ({
  order_id: id("75", n),
  expected_version_id: id("76", n),
  expected_revision: 1,
  mode,
});
const cmd = (key, numbers, modes = []) => ({
  receipt_id: receipt(key),
  confirmed: true,
  items: numbers.map((n, i) => item(n, modes[i] ?? "clinic_pickup")),
});
const connections = [];
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
    "SELECT current_database() AS db,current_setting('data_directory') AS dir,current_setting('port') AS port,current_setting('server_version_num')::int AS version",
  );
  assert.equal(r.db, "dental_lab");
  assert.equal(r.dir, root + "/pgdata");
  assert.equal(r.port, String(port));
  assert.ok(r.version >= 170000 && r.version < 180000);
  return client;
}
function service(client, hook = async () => {}) {
  return createDeliveryBatchService({
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
  });
}
async function snapshot(client) {
  const {
    rows: [r],
  } = await client.query(
    "SELECT (SELECT count(*)::int FROM public.orders WHERE status='delivered') AS delivered,(SELECT count(*)::int FROM public.order_status_events WHERE next_status='delivered') AS events,(SELECT count(*)::int FROM public.order_logistics_events) AS logistics,(SELECT count(*)::int FROM public.audit_events WHERE action='ORDER_DELIVERED') AS audits,(SELECT count(*)::int FROM public.delivery_batch_receipts) AS receipts",
  );
  return r;
}
async function waitForLock(observer, pid) {
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
  throw new Error("REAL_LOCK_WAIT_NOT_OBSERVED");
}
function gate() {
  let release, enter;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  const entered = new Promise((resolve) => {
    enter = resolve;
  });
  return {
    promise,
    entered,
    markEntered: () => enter(),
    release: () => release(),
  };
}
try {
  assert.equal(
    process.env.DENTAL_BATCH_V5_APPROVED,
    "private-unix-socket-one-shot",
  );
  assert.equal(process.getuid(), 1002);
  const a = await connect(),
    b = await connect(),
    observer = await connect();
  assert.deepEqual(await snapshot(observer), {
    delivered: 0,
    events: 0,
    logistics: 0,
    audits: 0,
    receipts: 0,
  });
  const first = await service(a).deliver(
    owner,
    cmd(1, [1, 2], ["clinic_pickup", "external_courier"]),
  );
  assert.equal(first.result.kind, "delivered");
  assert.equal(first.result.items.length, 2);
  assert.deepEqual(await snapshot(observer), {
    delivered: 2,
    events: 2,
    logistics: 2,
    audits: 2,
    receipts: 1,
  });
  const { rows: logistics } = await observer.query(
    "SELECT order_id,delivery_mode,delivered_by,delivered_at,archive_due_at FROM public.order_logistics WHERE order_id=ANY($1::uuid[]) ORDER BY order_id",
    [[id("75", 1), id("75", 2)]],
  );
  assert.deepEqual(
    logistics.map((r) => r.delivery_mode),
    ["clinic_pickup", "external_courier"],
  );
  assert.ok(
    logistics.every(
      (r) =>
        r.delivered_by === owner.accountId &&
        r.archive_due_at - r.delivered_at === 30 * 86400000,
    ),
  );
  assert.equal(
    logistics[0].delivered_at.toISOString(),
    logistics[1].delivered_at.toISOString(),
  );
  assert.deepEqual(
    await service(a).deliver(
      owner,
      cmd(1, [2, 1], ["external_courier", "clinic_pickup"]),
    ),
    first,
  );
  assert.equal(
    (
      await service(a).deliver(
        owner,
        cmd(1, [1, 2], ["external_courier", "clinic_pickup"]),
      )
    ).result.kind,
    "receipt_mismatch",
  );
  assert.deepEqual(
    await service(a).receipt(owner, { receipt_id: receipt(1) }),
    first,
  );
  assert.equal(
    (await service(a).receipt(clinic, { receipt_id: receipt(1) })).kind,
    "denied",
  );
  // Check table grants and trigger guards under the exact application role.
  await observer.query("BEGIN");
  try {
    await observer.query("SET LOCAL ROLE dental_lab_app");
    const {
      rows: [grants],
    } = await observer.query(
      "SELECT has_table_privilege(current_user,'public.delivery_batch_receipts','SELECT') AS can_read,has_table_privilege(current_user,'public.delivery_batch_receipts','INSERT') AS can_insert,has_table_privilege(current_user,'public.delivery_batch_receipts','DELETE') AS can_delete,has_table_privilege(current_user,'public.audit_events','UPDATE') AS can_edit_audit,has_table_privilege(current_user,'public.audit_events','DELETE') AS can_delete_audit",
    );
    assert.deepEqual(grants, {
      can_read: true,
      can_insert: true,
      can_delete: false,
      can_edit_audit: false,
      can_delete_audit: false,
    });
    await assert.rejects(
      observer.query(
        'UPDATE public.delivery_batch_receipts SET result=\'{"kind":"pending"}\'::jsonb WHERE id=$1',
        [receipt(1)],
      ),
      /DELIVERY_BATCH_RECEIPT_IMMUTABLE/,
    );
  } finally {
    await observer.query("ROLLBACK");
  }
  await observer.query("BEGIN");
  try {
    await observer.query("SET LOCAL ROLE dental_lab_app");
    await assert.rejects(
      observer.query(
        "INSERT INTO public.delivery_batch_receipts(id,actor_id,payload_hash,result) VALUES($1,$2,decode(repeat('aa',32),'hex'),$3::jsonb)",
        [receipt(19), owner.accountId, JSON.stringify(first.result)],
      ),
      /DELIVERY_BATCH_RECEIPT_MUST_START_PENDING/,
    );
  } finally {
    await observer.query("ROLLBACK");
  }
  await observer.query("BEGIN");
  await observer.query("SET LOCAL ROLE dental_lab_app");
  await observer.query(
    "INSERT INTO public.delivery_batch_receipts(id,actor_id,payload_hash,result) VALUES($1,$2,decode(repeat('aa',32),'hex'),'{\"kind\":\"pending\"}'::jsonb)",
    [receipt(19), owner.accountId],
  );
  await assert.rejects(
    observer.query("COMMIT"),
    /DELIVERY_BATCH_RECEIPT_PENDING_AT_COMMIT/,
  );
  assert.equal((await snapshot(observer)).receipts, 1);
  const beforeMixed = await snapshot(observer);
  assert.equal(
    (await service(a).deliver(owner, cmd(2, [1, 3]))).result.kind,
    "conflict",
  );
  assert.deepEqual(await snapshot(observer), beforeMixed);
  assert.equal(
    (
      await service(a).deliver(owner, {
        ...cmd(2, [3, 4]),
        items: [{ ...item(3), expected_revision: 9 }, item(4)],
      })
    ).result.kind,
    "conflict",
  );
  assert.equal(
    (
      await service(a).deliver(owner, {
        ...cmd(2, [3, 4]),
        items: [{ ...item(3), expected_version_id: receipt(99) }, item(4)],
      })
    ).result.kind,
    "conflict",
  );
  assert.deepEqual(await snapshot(observer), beforeMixed);
  await observer.query(
    "UPDATE public.catalog_references SET use_state='forbidden',forbidden_reason='Synthetic safety restriction' WHERE id=$1",
    [id("73", 1)],
  );
  try {
    assert.deepEqual((await service(a).deliver(owner, cmd(2, [3, 4]))).result, {
      kind: "blocked",
      reason: "catalog_forbidden",
    });
    assert.deepEqual(await snapshot(observer), beforeMixed);
  } finally {
    await observer.query(
      "UPDATE public.catalog_references SET use_state='available',forbidden_reason=NULL WHERE id=$1",
      [id("73", 1)],
    );
  }
  await observer.query(
    "INSERT INTO public.order_requests(order_id,clinic_id,kind,base_version_id,requested_by) VALUES($1,$2,'cancellation',$3,$4)",
    [id("75", 3), id("72", 1), id("76", 3), owner.accountId],
  );
  try {
    assert.deepEqual((await service(a).deliver(owner, cmd(2, [3, 4]))).result, {
      kind: "blocked",
      reason: "pending_request",
    });
    assert.deepEqual(await snapshot(observer), beforeMixed);
  } finally {
    await observer.query(
      "DELETE FROM public.order_requests WHERE order_id=$1",
      [id("75", 3)],
    );
  }
  await observer.query(
    "INSERT INTO public.order_security_blocks(order_id,clinic_id,reference_id,reason,created_by) VALUES($1,$2,$3,'Synthetic block',$4)",
    [id("75", 3), id("72", 1), id("73", 1), owner.accountId],
  );
  try {
    assert.deepEqual((await service(a).deliver(owner, cmd(2, [3, 4]))).result, {
      kind: "blocked",
      reason: "security_block",
    });
    assert.deepEqual(await snapshot(observer), beforeMixed);
  } finally {
    await observer.query(
      "DELETE FROM public.order_security_blocks WHERE order_id=$1",
      [id("75", 3)],
    );
  }
  await observer.query(
    "INSERT INTO public.file_objects(id,clinic_id,created_by,object_key,filename_original,format,size_bytes,state,storage_policy_version) VALUES($1,$2,$3,repeat('a',64),'fixture.pdf','pdf',1,'verifying','fixture')",
    [id("79", 1), id("72", 1), owner.accountId],
  );
  await observer.query(
    "INSERT INTO public.order_version_files(version_id,order_id,clinic_id,file_id,attached_by) VALUES($1,$2,$3,$4,$5)",
    [id("76", 3), id("75", 3), id("72", 1), id("79", 1), owner.accountId],
  );
  try {
    assert.deepEqual((await service(a).deliver(owner, cmd(2, [3, 4]))).result, {
      kind: "blocked",
      reason: "files_not_ready",
    });
    assert.deepEqual(await snapshot(observer), beforeMixed);
  } finally {
    await observer.query(
      "DELETE FROM public.order_version_files WHERE file_id=$1",
      [id("79", 1)],
    );
    await observer.query("DELETE FROM public.file_objects WHERE id=$1", [
      id("79", 1),
    ]);
  }
  assert.equal(
    (await service(a).deliver(clinic, cmd(2, [3, 4]))).kind,
    "denied",
  );
  assert.deepEqual(await snapshot(observer), beforeMixed);
  let injected = false;
  const fail = service(a, async (sql) => {
    if (!injected && sql.startsWith("UPDATE public.orders")) {
      injected = true;
      throw new Error("INJECTED_AFTER_FIRST_ORDER_WRITE");
    }
  });
  await assert.rejects(
    fail.deliver(owner, cmd(3, [3, 4])),
    /INJECTED_AFTER_FIRST_ORDER_WRITE/,
  );
  assert.deepEqual(await snapshot(observer), beforeMixed);
  const one = gate();
  let pauseOne = true;
  const firstConcurrent = service(a, async (sql) => {
    if (
      pauseOne &&
      sql.startsWith("INSERT INTO public.delivery_batch_receipts")
    ) {
      pauseOne = false;
      one.markEntered();
      await one.promise;
    }
  }).deliver(owner, cmd(4, [3, 4]));
  try {
    // A committed receipt is invisible until the transaction completes. The other backend must wait on its unique key.
    await one.entered;
    const secondConcurrent = service(b).deliver(owner, cmd(4, [3, 4]));
    await waitForLock(observer, b.processID);
    one.release();
    const [x, y] = await Promise.all([firstConcurrent, secondConcurrent]);
    assert.deepEqual(x, y);
    assert.equal(x.result.kind, "delivered");
  } finally {
    one.release();
  }
  assert.deepEqual(
    await service(b).receipt(owner, { receipt_id: receipt(4) }),
    await service(a).receipt(owner, { receipt_id: receipt(4) }),
  );
  assert.deepEqual(await snapshot(observer), {
    delivered: 4,
    events: 4,
    logistics: 4,
    audits: 4,
    receipts: 2,
  });
  const two = gate();
  let pauseTwo = true;
  const winner = service(a, async (sql) => {
    if (pauseTwo && sql.includes("FROM public.orders WHERE id=$1 FOR UPDATE")) {
      pauseTwo = false;
      two.markEntered();
      await two.promise;
    }
  }).deliver(owner, cmd(5, [5, 6]));
  try {
    // The reverse request order still acquires order locks in sorted order.
    await two.entered;
    const loser = service(b).deliver(owner, cmd(6, [6, 5]));
    await waitForLock(observer, b.processID);
    two.release();
    const [x, y] = await Promise.all([winner, loser]);
    assert.equal(x.result.kind, "delivered");
    assert.equal(y.result.kind, "conflict");
  } finally {
    two.release();
  }
  assert.deepEqual(await snapshot(observer), {
    delivered: 6,
    events: 6,
    logistics: 6,
    audits: 6,
    receipts: 3,
  });
  const {
    rows: [mail],
  } = await observer.query(
    "SELECT count(*)::int AS n FROM public.notification_deliveries d JOIN public.outbox_events e ON e.id=d.event_id WHERE e.type='order_delivered'",
  );
  assert.equal(mail.n, 0);
  process.stdout.write(
    JSON.stringify({
      result: "real-postgres-batch-passed",
      version: 17,
      checks: [
        "atomic",
        "rollback",
        "idempotent-receipt",
        "real-unique-lock",
        "real-order-lock",
        "scoped-permission",
        "no-clinic-mail",
        "finalized-receipt-immutable",
        "pending-receipt-rollback",
        "stale-version-and-revision",
        "catalog-and-pending-request-blocks",
      ],
    }) + "\n",
  );
} finally {
  await Promise.allSettled(connections.map((c) => c.end()));
}
