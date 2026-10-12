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

async function withTransactionClient(run, override) {
  const release = vi.fn();
  const query = vi.fn(async (sql, values) => {
    if (sql.includes("current_database()")) return { rows: [valid] };
    return override ? override(sql, values) : { rows: [], rowCount: 1 };
  });
  const connect = vi
    .spyOn(pg.Pool.prototype, "connect")
    .mockResolvedValue({ query, release });
  const end = vi.spyOn(pg.Pool.prototype, "end").mockResolvedValue();
  const db = createApplicationDatabase({});
  try {
    await run(db, query, release, connect);
  } finally {
    await db.close();
    connect.mockRestore();
    end.mockRestore();
    vi.useRealTimers();
  }
}
test("transaction verifies once, commits both writes on one checkout, closes its scope", async () => {
  await withTransactionClient(async (db, query, release, connect) => {
    let escaped;
    expect(
      await db.transaction(async (tx) => {
        escaped = tx;
        await tx.query("INSERT first VALUES ($1)", ["private"]);
        await tx.query("INSERT second VALUES ($1)", [42]);
        return "committed";
      }),
    ).toBe("committed");
    expect(connect).toHaveBeenCalledOnce();
    expect(query.mock.calls.slice(1)).toEqual([
      ["BEGIN"],
      ["SET LOCAL transaction_timeout = '10s'"],
      ["INSERT first VALUES ($1)", ["private"]],
      ["INSERT second VALUES ($1)", [42]],
      ["COMMIT"],
    ]);
    expect(release).toHaveBeenCalledExactlyOnceWith(false);
    await expect(escaped.query("SELECT 1")).rejects.toThrow(
      "DATABASE_TRANSACTION_NOT_AVAILABLE",
    );
    expect(query).toHaveBeenCalledTimes(6);
  });
});
test("callback or caught SQL failure rolls back and never commits", async () => {
  for (const swallow of [false, true]) {
    await withTransactionClient(
      async (db, query, release) => {
        await expect(
          db.transaction(async (tx) => {
            try {
              await tx.query("INSERT failure");
            } catch (error) {
              if (!swallow) throw error;
            }
          }),
        ).rejects.toThrow(
          swallow ? "DATABASE_TRANSACTION_INCOMPLETE" : "fake SQL failure",
        );
        expect(query.mock.calls.map((c) => c[0])).not.toContain("COMMIT");
        expect(query).toHaveBeenLastCalledWith("ROLLBACK");
        expect(release).toHaveBeenCalledExactlyOnceWith(false);
      },
      async (sql) => {
        if (sql === "INSERT failure") throw new Error("fake SQL failure");
        return { rows: [] };
      },
    );
  }
});
test("uncertain commit and failed rollback discard without automatic replay", async () => {
  for (const failing of ["COMMIT", "ROLLBACK"]) {
    await withTransactionClient(
      async (db, query, release) => {
        await expect(
          db.transaction(async (tx) => {
            await tx.query("INSERT once");
            if (failing === "ROLLBACK") throw new Error("callback failure");
          }),
        ).rejects.toThrow();
        expect(
          query.mock.calls.filter((c) => c[0] === "INSERT once"),
        ).toHaveLength(1);
        expect(release).toHaveBeenCalledExactlyOnceWith(true);
        if (failing === "COMMIT")
          expect(query.mock.calls.map((c) => c[0])).not.toContain("ROLLBACK");
      },
      async (sql) => {
        if (sql === failing) throw new Error("connection lost");
        return { rows: [] };
      },
    );
  }
});
test("unfinished query cannot escape transaction and concurrent misuse poisons it", async () => {
  let finish;
  await withTransactionClient(
    async (db, query, release) => {
      let outstanding;
      await expect(
        db.transaction(async (tx) => {
          outstanding = tx.query("SELECT delayed");
          await expect(tx.query("SELECT parallel")).rejects.toThrow(
            "DATABASE_TRANSACTION_NOT_AVAILABLE",
          );
        }),
      ).rejects.toThrow("DATABASE_TRANSACTION_INCOMPLETE");
      expect(release).toHaveBeenCalledExactlyOnceWith(true);
      expect(query.mock.calls.map((c) => c[0])).not.toContain("COMMIT");
      finish({ rows: [] });
      await outstanding;
    },
    (sql) =>
      sql === "SELECT delayed"
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : { rows: [] },
  );
});
test("deadline discards connection and prevents late callback writes", async () => {
  await withTransactionClient(async (db, query, release) => {
    vi.useFakeTimers();
    let resume;
    let escaped;
    const attempt = db.transaction(async (tx) => {
      escaped = tx;
      await new Promise((resolve) => {
        resume = resolve;
      });
      await tx.query("INSERT too_late");
    });
    const result = expect(attempt).rejects.toThrow(
      "DATABASE_TRANSACTION_TIMEOUT",
    );
    await vi.advanceTimersByTimeAsync(10000);
    await result;
    expect(release).toHaveBeenCalledExactlyOnceWith(true);
    resume();
    await expect(escaped.query("SELECT later")).rejects.toThrow(
      "DATABASE_TRANSACTION_NOT_AVAILABLE",
    );
    expect(query.mock.calls.map((c) => c[0])).not.toContain("INSERT too_late");
  });
});
test("transaction rejects wrong checkout identity before BEGIN", async () => {
  const query = vi
    .fn()
    .mockResolvedValue({ rows: [{ ...valid, identity: "dental-ai" }] });
  const release = vi.fn();
  const connect = vi
    .spyOn(pg.Pool.prototype, "connect")
    .mockResolvedValue({ query, release });
  const end = vi.spyOn(pg.Pool.prototype, "end").mockResolvedValue();
  const db = createApplicationDatabase({});
  const callback = vi.fn();
  try {
    await expect(db.transaction(callback)).rejects.toThrow(
      "DATABASE_IDENTITY_OR_PRIVILEGES_INVALID",
    );
    expect(callback).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledExactlyOnceWith(true);
  } finally {
    await db.close();
    connect.mockRestore();
    end.mockRestore();
  }
});
