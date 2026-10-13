import { expect, test } from "vitest";
import { createPersistentLoginLimiter } from "../../apps/api/dist/modules/identity/login-limit.repository.js";
const policy = {
  windowMs: 10000,
  accountAttempts: 2,
  networkAttempts: 3,
  maxKeys: 10,
};
function databaseFixture() {
  let state = { policy: null, entries: new Map() },
    at = 1800000000000,
    fail = false,
    tail = Promise.resolve();
  const seen = [];
  const database = {
    transaction(work) {
      const operation = tail.then(async () => {
        const next = {
          policy: state.policy,
          entries: new Map(
            [...state.entries].map(([key, value]) => [key, { ...value }]),
          ),
        };
        let inserts = 0;
        const value = await work({
          query: async (sql, values = []) => {
            seen.push({ sql, values });
            if (sql.startsWith("SELECT policy_digest"))
              return { rows: [{ policy_digest: next.policy }] };
            if (sql.startsWith("UPDATE public.login_limit_guard")) {
              next.policy = values[0];
              return { rows: [] };
            }
            if (sql.startsWith("SELECT (extract"))
              return { rows: [{ at: String(at) }] };
            if (sql.startsWith("DELETE")) {
              for (const [key, entry] of next.entries)
                if (entry.expires <= values[0].getTime())
                  next.entries.delete(key);
              return { rows: [] };
            }
            if (sql.startsWith("SELECT key_digest"))
              return {
                rows: values[0].flatMap((key) => {
                  const value = next.entries.get(key.toString("hex"));
                  return value
                    ? [
                        {
                          key_digest: key,
                          attempts: value.attempts,
                          expires: String(value.expires),
                        },
                      ]
                    : [];
                }),
              };
            if (sql.startsWith("SELECT count"))
              return { rows: [{ count: next.entries.size }] };
            if (sql.startsWith("INSERT INTO public.login_attempt_limits")) {
              inserts++;
              if (fail && inserts === 2)
                throw new Error("injected second-key failure");
              const key = values[0].toString("hex"),
                entry = next.entries.get(key);
              next.entries.set(key, {
                attempts: (entry?.attempts ?? 0) + 1,
                expires: entry?.expires ?? values[1].getTime(),
              });
              return { rows: [] };
            }
            throw new Error("Unexpected SQL");
          },
        });
        state = next;
        return value;
      });
      tail = operation.catch(() => {});
      return operation;
    },
  };
  return {
    database,
    seen,
    advance: (ms) => {
      at += ms;
    },
    fail: () => {
      fail = true;
    },
    entries: () => state.entries,
  };
}
test("persistent counters survive adapter recreation and reject concurrent excess with fixed expiry", async () => {
  const f = databaseFixture();
  const first = createPersistentLoginLimiter(f.database, policy);
  expect(
    await first.consume("synthetic@example.test", "synthetic-network"),
  ).toEqual({ allowed: true });
  const restarted = createPersistentLoginLimiter(f.database, policy);
  const results = await Promise.all([
    restarted.consume("synthetic@example.test", "synthetic-network"),
    first.consume("synthetic@example.test", "synthetic-network"),
  ]);
  expect(results).toEqual([
    { allowed: true },
    { allowed: false, retryAfterSeconds: 10 },
  ]);
  f.advance(5000);
  expect(
    await restarted.consume("synthetic@example.test", "synthetic-network"),
  ).toEqual({ allowed: false, retryAfterSeconds: 5 });
  f.advance(5000);
  expect(
    await restarted.consume("synthetic@example.test", "synthetic-network"),
  ).toEqual({ allowed: true });
  expect(f.entries().size).toBe(2);
  expect(JSON.stringify(f.seen)).not.toContain("synthetic@example.test");
  expect(JSON.stringify(f.seen)).not.toContain("synthetic-network");
});
test("network limit also covers different and nonexistent accounts", async () => {
  const f = databaseFixture();
  const limiter = createPersistentLoginLimiter(f.database, {
    ...policy,
    networkAttempts: 1,
  });
  expect((await limiter.consume("missing-one", "network")).allowed).toBe(true);
  expect(await limiter.consume("missing-two", "network")).toEqual({
    allowed: false,
    retryAfterSeconds: 10,
  });
});
test("capacity fails closed without deleting active counters", async () => {
  const f = databaseFixture();
  const limiter = createPersistentLoginLimiter(f.database, {
    ...policy,
    maxKeys: 2,
  });
  await limiter.consume("one", "network");
  expect((await limiter.consume("two", "other")).allowed).toBe(false);
  expect(f.entries().size).toBe(2);
  f.advance(10000);
  expect((await limiter.consume("two", "other")).allowed).toBe(true);
});
test("second-key error rolls back admission; incompatible process policy fails closed", async () => {
  const f = databaseFixture();
  const limiter = createPersistentLoginLimiter(f.database, policy);
  f.fail();
  await expect(limiter.consume("one", "network")).rejects.toThrow(
    "injected second-key failure",
  );
  expect(f.entries().size).toBe(0);
  const g = databaseFixture();
  await createPersistentLoginLimiter(g.database, policy).consume(
    "one",
    "network",
  );
  await expect(
    createPersistentLoginLimiter(g.database, {
      ...policy,
      accountAttempts: 3,
    }).consume("one", "network"),
  ).rejects.toThrow("LOGIN_LIMIT_POLICY_MISMATCH");
});
test("persistent policy bounds prevent unbounded storage, duration or numeric overflow", () => {
  for (const patch of [
    { maxKeys: 1 },
    { maxKeys: 100001 },
    { windowMs: 999 },
    { windowMs: 86400001 },
    { accountAttempts: 1000001 },
    { networkAttempts: NaN },
  ])
    expect(() =>
      createPersistentLoginLimiter({}, { ...policy, ...patch }),
    ).toThrow("INVALID_LOGIN_LIMIT_POLICY");
});
