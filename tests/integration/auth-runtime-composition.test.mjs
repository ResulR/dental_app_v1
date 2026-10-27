import { expect, test, vi } from "vitest";
import pg from "pg";
import { createRuntime } from "../../apps/api/dist/app/runtime.js";
import { readConfig } from "../../apps/api/dist/app/config.js";
import { startServer, closeServer } from "../../apps/api/dist/app/server.js";
import { hashPassword } from "../../apps/api/dist/modules/identity/index.js";
const identity = {
  database: "dental_lab",
  identity: "dental-lab-runtime",
  session_identity: "dental-lab-runtime",
  version: 170011,
  administrative: false,
  db_create: false,
  db_temp: false,
  schema_create: false,
  forbidden_membership: false,
  app_membership: true,
  unexpected_membership: false,
  owned_objects: false,
};
const accountId = "10000000-0000-4000-8000-000000000001";
const env = {
  NODE_ENV: "test",
  DENTAL_LAB_PORT: "0",
  DENTAL_LAB_AUTH_ENABLED: "true",
  DENTAL_LAB_ORIGIN: "https://dental.example.test",
  DENTAL_LAB_SESSION_LIFETIME_MS: "60000",
  DENTAL_LAB_SESSION_ABSOLUTE_MS: "120000",
  DENTAL_LAB_LOGIN_WINDOW_MS: "10000",
  DENTAL_LAB_LOGIN_ACCOUNT_ATTEMPTS: "3",
  DENTAL_LAB_LOGIN_NETWORK_ATTEMPTS: "10",
  DENTAL_LAB_LOGIN_MAX_KEYS: "100",
};
// Real composition, HTTP, KDF and repositories; pg transport is explicitly
// doubled. This does not assert SQL syntax, privileges or live concurrency.
test("configured entry-point runtime connects HTTP login to credential, limiter, session, limit and audit repositories", async () => {
  const password = "synthetic-composition-password";
  const passwordHash = await hashPassword(password);
  const statements = [];
  let saved;
  const query = vi.fn(async (sql, values = []) => {
    statements.push({ sql, values });
    if (sql.includes("current_database()"))
      return { rows: [identity], rowCount: 1 };
    if (sql.includes("auth_readiness"))
      return {
        rows: [
          { readable: true, insertable: true, updatable: true, cleanup: true },
        ],
        rowCount: 1,
      };
    if (
      ["BEGIN", "COMMIT", "ROLLBACK"].includes(sql) ||
      sql.startsWith("SET LOCAL")
    )
      return { rows: [], rowCount: null };
    if (sql.startsWith("SELECT policy_digest"))
      return { rows: [{ policy_digest: null }], rowCount: 1 };
    if (sql.startsWith("SELECT (extract"))
      return { rows: [{ at: String(Date.now()) }], rowCount: 1 };
    if (sql.startsWith("SELECT key_digest")) return { rows: [], rowCount: 0 };
    if (sql.startsWith("SELECT count"))
      return { rows: [{ count: 0 }], rowCount: 1 };
    if (sql.includes("a.email_key=$1"))
      return {
        rows: [
          {
            id: accountId,
            profile: "employee",
            lifecycle: "active",
            security_locked: false,
            credential_reset_required: false,
            clinic_suspended: false,
            auth_epoch: "1",
            password_hash: passwordHash,
          },
        ],
        rowCount: 1,
      };
    if (sql.includes("FROM public.accounts WHERE"))
      return {
        rows: [
          {
            profile: "employee",
            lifecycle: "active",
            security_locked: false,
            credential_reset_required: false,
            auth_epoch: "1",
          },
        ],
        rowCount: 1,
      };
    if (sql.includes("INSERT INTO public.sessions"))
      saved = {
        id: values[0],
        accountId: values[1],
        digest: values[2],
        authEpoch: values[3],
        createdAt: String(values[4].getTime()),
        expiresAt: String(values[5].getTime()),
      };
    if (sql.includes("INSERT INTO public.session_limits"))
      saved.absoluteExpiresAt = String(values[3].getTime());
    if (sql.includes("WHERE s.secret_digest=$1"))
      return {
        rows: saved?.digest.equals(values[0])
          ? [
              {
                ...saved,
                profile: "employee",
                currentAuthEpoch: "1",
                accountUsable: true,
                revokedAt: null,
              },
            ]
          : [],
        rowCount: saved ? 1 : 0,
      };
    if (
      sql.startsWith("DELETE") ||
      sql.includes("INSERT") ||
      sql.startsWith("UPDATE")
    )
      return { rows: [], rowCount: 1 };
    throw new Error("UNEXPECTED_TEST_SQL");
  });
  const release = vi.fn();
  const connect = vi
    .spyOn(pg.Pool.prototype, "connect")
    .mockImplementation(async () => ({ query, release }));
  const end = vi.spyOn(pg.Pool.prototype, "end").mockResolvedValue();
  let runtime, server;
  try {
    runtime = await createRuntime(env);
    server = await startServer(readConfig(env), runtime.registerRoutes);
    const base = "http://127.0.0.1:" + server.address().port;
    const response = await fetch(base + "/api/v1/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: env.DENTAL_LAB_ORIGIN,
      },
      body: JSON.stringify({ email: "user@example.test", password }),
    });
    expect(response.status).toBe(204);
    const cookie = response.headers.get("set-cookie").split(";")[0];
    const current = await fetch(base + "/api/v1/auth/session", {
      headers: { Cookie: cookie },
    });
    expect(current.status).toBe(200);
    expect(await current.json()).toEqual({
      account_id: accountId,
      profile: "employee",
    });
    const writes = statements.filter(
      (entry) =>
        entry.sql.includes("INSERT INTO public.sessions") ||
        entry.sql.includes("INSERT INTO public.session_limits") ||
        entry.sql.includes("INSERT INTO public.audit_events"),
    );
    expect(writes).toHaveLength(3);
    expect(writes[2].values[2]).toBe(response.headers.get("x-request-id"));
    const start = statements.findIndex((entry) =>
      entry.sql.includes("INSERT INTO public.sessions"),
    );
    const commit = statements.findIndex(
      (entry, index) => index > start && entry.sql === "COMMIT",
    );
    expect(commit).toBeGreaterThan(start + 2);
    expect(writes[0].values[2]).toHaveLength(32);
    expect(JSON.stringify(writes)).not.toContain(password);
    expect(release.mock.calls.every(([discard]) => discard === false)).toBe(
      true,
    );
  } finally {
    if (server) await closeServer(server);
    if (runtime) await runtime.close();
    connect.mockRestore();
    end.mockRestore();
  }
}, 15_000); // Real scrypt plus HTTP can exceed the generic 5 s limit under the VPS CPU quota.
