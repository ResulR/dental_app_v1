import { expect, test, vi } from "vitest";
import {
  applicationPoolConfig,
  assertApplicationSession,
  createApplicationDatabase,
} from "../../apps/api/dist/shared/database.js";
import pg from "pg";

const valid = {
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
test("fixed peer target, bounded pool, no credentials or ambient redirects", () => {
  const config = applicationPoolConfig({});
  expect(config).toMatchObject({
    database: "dental_lab",
    user: "dental-lab-runtime",
    host: "/var/run/postgresql",
    port: 5432,
    ssl: false,
    max: 2,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
    query_timeout: 7000,
  });
  expect(() => config.password()).toThrow("DATABASE_PASSWORD_AUTH_FORBIDDEN");
  for (const env of [
    { PGDATABASE: "postgres" },
    { PGUSER: "dental-ai" },
    { PGHOST: "127.0.0.1" },
    { PGPASSWORD: "fake-only" },
    { PGOPTIONS: "-c role=dental_lab_owner" },
    { PGSSLMODE: "require" },
    { PGSERVICE: "anything" },
    { NODE_PG_FORCE_NATIVE: "1" },
  ])
    expect(() => applicationPoolConfig(env)).toThrow("INVALID_DATABASE_CONFIG");
  expect(applicationPoolConfig({ PGDATABASE: "dental_lab" }).database).toBe(
    "dental_lab",
  );
});
test("reject privilege escalation, wrong identity, wrong server and incomplete checks", () => {
  expect(() => assertApplicationSession(valid)).not.toThrow();
  for (const key of [
    "administrative",
    "db_create",
    "db_temp",
    "schema_create",
    "forbidden_membership",
    "unexpected_membership",
    "owned_objects",
  ])
    expect(() => assertApplicationSession({ ...valid, [key]: true })).toThrow();
  for (const patch of [
    { database: "other" },
    { identity: "dental-ai" },
    { session_identity: "dental-ai" },
    { version: 180000 },
    { version: "170011" },
    { app_membership: false },
  ])
    expect(() => assertApplicationSession({ ...valid, ...patch })).toThrow();
  expect(() => assertApplicationSession(undefined)).toThrow();
});
test("checkout guard, parameterized query, release on failure and shutdown", async () => {
  const release = vi.fn();
  const query = vi
    .fn()
    .mockResolvedValueOnce({ rows: [valid] })
    .mockResolvedValueOnce({ rows: [{ ok: 1 }] });
  const connect = vi
    .spyOn(pg.Pool.prototype, "connect")
    .mockResolvedValue({ query, release });
  const end = vi.spyOn(pg.Pool.prototype, "end").mockResolvedValue();
  try {
    const db = createApplicationDatabase({});
    await expect(db.query("SELECT $1::integer AS ok", [1])).resolves.toEqual({
      rows: [{ ok: 1 }],
    });
    expect(query).toHaveBeenLastCalledWith("SELECT $1::integer AS ok", [1]);
    expect(release).toHaveBeenLastCalledWith(false);
    query.mockResolvedValueOnce({ rows: [{ ...valid, administrative: true }] });
    await expect(db.query("SELECT 1")).rejects.toThrow(
      "DATABASE_IDENTITY_OR_PRIVILEGES_INVALID",
    );
    expect(query).toHaveBeenCalledTimes(3);
    expect(release).toHaveBeenLastCalledWith(true);
    query
      .mockResolvedValueOnce({ rows: [valid] })
      .mockRejectedValueOnce(new Error("fake SQL error"));
    await expect(db.query("SELECT 1")).rejects.toThrow("fake SQL error");
    expect(release).toHaveBeenLastCalledWith(true);
    await db.close();
    expect(end).toHaveBeenCalledOnce();
  } finally {
    connect.mockRestore();
    end.mockRestore();
  }
});
