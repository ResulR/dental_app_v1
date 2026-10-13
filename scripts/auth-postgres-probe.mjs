// Administrator-authorized protected copy only; never execute as dental-ai/root.
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createApplicationDatabase } from "../apps/api/dist/shared/database.js";
import { assertAuthStorageReady } from "../apps/api/dist/modules/identity/auth-readiness.js";
import { createIdentityRepository } from "../apps/api/dist/modules/identity/identity.repository.js";
import { createSessionRepository } from "../apps/api/dist/modules/identity/session.repository.js";
import { createPersistentLoginLimiter } from "../apps/api/dist/modules/identity/login-limit.repository.js";

export async function runAuthPostgresProbe(database) {
  await assertAuthStorageReady(database);
  const id = randomUUID(),
    email = id + "@example.invalid";
  const rollback = new Error("PROBE_EXPECTED_ROLLBACK");
  let completed = false;
  try {
    await database.transaction(async (tx) => {
      const active = await tx.query(
        "SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname=current_database() AND usename=current_user AND pid<>pg_backend_pid()",
      );
      assert.equal(active.rows[0].count, 0, "PROBE_REQUIRES_RUNTIME_STOPPED");
      const owner = await tx.query(
        "SELECT singleton FROM public.owner_slot WHERE singleton=1",
      );
      assert.equal(
        owner.rowCount,
        1,
        "PROBE_REQUIRES_APPROVED_OWNER_BOOTSTRAP",
      );
      const guard = await tx.query(
        "SELECT policy_digest FROM public.login_limit_guard WHERE singleton=1 FOR UPDATE",
      );
      assert.equal(
        guard.rows[0]?.policy_digest,
        null,
        "PROBE_REQUIRES_UNUSED_LIMITER",
      );
      const counters = await tx.query(
        "SELECT count(*)::integer AS count FROM public.login_attempt_limits",
      );
      assert.equal(counters.rows[0].count, 0, "PROBE_REQUIRES_EMPTY_LIMITER");
      await tx.query(
        "INSERT INTO public.accounts(id,profile,email_original,email_key,lifecycle) VALUES ($1,'employee',$2,$2,'active')",
        [id, email],
      );
      await tx.query(
        "INSERT INTO public.credentials(account_id,password_hash) VALUES ($1,$2)",
        [id, "synthetic-probe-not-a-login-credential"],
      );
      // Probe-only ambient transaction: validate deferred FKs at each completed
      // operation, then roll back everything. Not a production transaction adapter.
      const scoped = {
        query: tx.query,
        transaction: async (work) => {
          await tx.query("SET CONSTRAINTS ALL DEFERRED");
          const value = await work(tx);
          await tx.query("SET CONSTRAINTS ALL IMMEDIATE");
          return value;
        },
      };
      const account =
        await createIdentityRepository(scoped).findCredential(email);
      assert.equal(account.id, id);
      assert.equal(account.profile, "employee");
      const store = createSessionRepository(scoped);
      const now = Date.now();
      const write = () => ({
        fact: {
          kind: "authenticated",
          accountId: id,
          profile: "employee",
          authEpoch: "0",
        },
        digest: createHash("sha256").update(randomBytes(32)).digest(),
        createdAt: now,
        expiresAt: now + 60000,
        absoluteExpiresAt: now + 120000,
      });
      const first = write(),
        second = write();
      assert.equal(await store.issue(first), true);
      assert.equal(await store.issue(second), true);
      const parent = await store.find(first.digest);
      assert.ok(parent?.accountUsable);
      const child = write();
      assert.equal(await store.rotate(parent, child), true);
      assert.equal(await store.rotate(parent, write()), false);
      assert.equal(await store.find(first.digest), undefined);
      assert.equal(
        (await store.find(child.digest)).absoluteExpiresAt,
        parent.absoluteExpiresAt,
      );
      const other = await store.find(second.digest);
      await store.revokeOne(id, other.id);
      assert.equal(await store.find(second.digest), undefined);
      assert.ok(await store.find(child.digest));
      await store.revokeAll(id);
      assert.equal(await store.find(child.digest), undefined);
      const stale = write();
      assert.equal(await store.issue(stale), false);
      const limiter = createPersistentLoginLimiter(scoped, {
        windowMs: 10000,
        accountAttempts: 1,
        networkAttempts: 2,
        maxKeys: 4,
      });
      assert.equal(
        (await limiter.consume(email, "synthetic-probe-network")).allowed,
        true,
      );
      assert.equal(
        (await limiter.consume(email, "synthetic-probe-network")).allowed,
        false,
      );
      await tx.query("SET CONSTRAINTS ALL IMMEDIATE");
      completed = true;
      throw rollback;
    });
    throw new Error("PROBE_UNEXPECTED_COMMIT");
  } catch (error) {
    if (error !== rollback || !completed)
      throw new Error("AUTH_POSTGRES_PROBE_FAILED", { cause: error });
  }
  const residue = await database.query(
    "SELECT EXISTS(SELECT 1 FROM public.accounts WHERE id=$1) AS present",
    [id],
  );
  assert.equal(residue.rows[0].present, false, "PROBE_ROLLBACK_RESIDUE");
  return {
    test: "auth_postgres_rollback",
    result: "passed",
    scope: "SQL_ACL_FK_sequential_only",
  };
}
if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  if (
    process.getuid() !== 994 ||
    process.env.DENTAL_LAB_PG_PROBE_APPROVED !== "rollback-v1"
  )
    throw new Error("PROBE_AUTHORIZED_RUNTIME_REQUIRED");
  const database = createApplicationDatabase(process.env);
  try {
    console.log(JSON.stringify(await runAuthPostgresProbe(database)));
  } catch {
    console.error(
      JSON.stringify({ test: "auth_postgres_rollback", result: "failed" }),
    );
    process.exitCode = 1;
  } finally {
    await database.close();
  }
}
