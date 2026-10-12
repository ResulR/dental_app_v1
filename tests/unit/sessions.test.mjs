import { expect, test } from "vitest";
import {
  createSessionService,
  readSessionCookie,
  clearSessionCookie,
  mutationOriginAllowed,
  sessionCookieName,
} from "../../apps/api/dist/modules/identity/index.js";

const fact = {
  kind: "authenticated",
  accountId: "fixture-account",
  profile: "clinic",
  authEpoch: "0",
};
function setup() {
  let at = 0,
    epoch = "0",
    enabled = true,
    nextId = 0;
  const rows = new Map();
  const store = {
    async find(hash) {
      const value = rows.get(hash.toString("hex"));
      return value
        ? { ...value, currentAuthEpoch: epoch, accountUsable: enabled }
        : undefined;
    },
    async issue(input) {
      if (!enabled || input.fact.authEpoch !== epoch) return false;
      rows.set(input.digest.toString("hex"), {
        id: String(++nextId),
        accountId: input.fact.accountId,
        profile: input.fact.profile,
        authEpoch: input.fact.authEpoch,
        currentAuthEpoch: epoch,
        accountUsable: enabled,
        createdAt: input.createdAt,
        expiresAt: input.expiresAt,
        absoluteExpiresAt: input.absoluteExpiresAt,
        revokedAt: null,
      });
      return true;
    },
    async rotate(old, input) {
      const original = [...rows.values()].find((row) => row.id === old.id);
      if (
        !original ||
        original.revokedAt !== null ||
        !enabled ||
        old.authEpoch !== epoch
      )
        return false;
      original.revokedAt = at;
      return store.issue(input);
    },
    async revokeOne(accountId, sessionId) {
      for (const row of rows.values())
        if (row.accountId === accountId && row.id === sessionId)
          row.revokedAt = at;
    },
    async revokeAll() {
      epoch = String(Number(epoch) + 1);
    },
  };
  const service = createSessionService(
    store,
    { lifetimeMs: 2000, absoluteLifetimeMs: 6000 },
    () => at,
  );
  return {
    service,
    rows,
    clock: (value) => {
      at = value;
    },
    suspend: () => {
      enabled = false;
    },
  };
}
function token(result) {
  return readSessionCookie(result.setCookie.split(";")[0]);
}
test("multi-device opaque cookies and only digests stored in the adapter", async () => {
  const f = setup();
  const one = await f.service.issue(fact);
  const two = await f.service.issue(fact);
  expect(token(one)).not.toBe(token(two));
  expect(one.setCookie).toContain(
    "Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2",
  );
  expect(one.setCookie).not.toContain("Domain=");
  expect([...f.rows.keys()]).not.toContain(token(one));
  expect(await f.service.authenticate(token(one))).toMatchObject({
    accountId: fact.accountId,
  });
  expect(await f.service.authenticate(token(two))).toMatchObject({
    accountId: fact.accountId,
  });
});
test("logout revokes one device; epoch change revokes all without deleting history", async () => {
  const f = setup();
  const one = token(await f.service.issue(fact));
  const two = token(await f.service.issue(fact));
  expect(await f.service.logout(one)).toBe(clearSessionCookie());
  expect(await f.service.authenticate(one)).toBeNull();
  expect(await f.service.authenticate(two)).not.toBeNull();
  await f.service.revokeAllForAccount(fact.accountId);
  expect(await f.service.authenticate(two)).toBeNull();
  expect(f.rows.size).toBe(2);
});
test("expired, suspended and epoch-stale sessions refused before access", async () => {
  const f = setup();
  const one = token(await f.service.issue(fact));
  f.clock(2000);
  expect(await f.service.authenticate(one)).toBeNull();
  const g = setup();
  const two = token(await g.service.issue(fact));
  g.suspend();
  expect(await g.service.authenticate(two)).toBeNull();
  expect(await g.service.issue(fact)).toBeNull();
});
test("rotation invalidates old token, preserves absolute bound and rejects replay", async () => {
  const f = setup();
  const one = token(await f.service.issue(fact));
  expect(await f.service.renew(one)).toEqual({ kind: "not_due" });
  f.clock(1000);
  const result = await f.service.renew(one);
  expect(result.kind).toBe("renewed");
  const two = token(result);
  expect(await f.service.authenticate(one)).toBeNull();
  expect(await f.service.renew(one)).toBeNull();
  expect(await f.service.authenticate(two)).not.toBeNull();
  expect(
    [...f.rows.values()].every((row) => row.absoluteExpiresAt === 6000),
  ).toBe(true);
  f.clock(6000);
  expect(await f.service.authenticate(two)).toBeNull();
});
test("duplicate/malformed cookie headers refused; clearing uses identical scope", () => {
  const cookie = sessionCookieName + "=" + "A".repeat(43);
  expect(readSessionCookie(cookie)).toBe("A".repeat(43));
  expect(readSessionCookie(cookie + "; " + cookie)).toBeNull();
  for (const value of [
    undefined,
    sessionCookieName + "=bad",
    "x".repeat(8193),
    sessionCookieName + "=" + "B".repeat(43),
  ])
    expect(readSessionCookie(value)).toBeNull();
  expect(clearSessionCookie()).toBe(
    sessionCookieName + "=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0",
  );
});
test("unsafe requests require exact configured HTTPS origin; never host-header authority", () => {
  expect(
    mutationOriginAllowed(
      "https://lab.example.invalid",
      "https://lab.example.invalid",
    ),
  ).toBe(true);
  for (const origin of [
    undefined,
    "null",
    "https://other.example.invalid",
    "http://lab.example.invalid",
    "https://lab.example.invalid:444",
  ])
    expect(mutationOriginAllowed(origin, "https://lab.example.invalid")).toBe(
      false,
    );
  expect(
    mutationOriginAllowed(
      "http://lab.example.invalid",
      "http://lab.example.invalid",
    ),
  ).toBe(false);
});
test("invalid policy and backward clock fail closed", async () => {
  expect(() => createSessionService({}, {})).toThrow("INVALID_SESSION_POLICY");
  const f = setup();
  f.clock(1000);
  await f.service.issue(fact);
  f.clock(999);
  await expect(f.service.issue(fact)).rejects.toThrow("INVALID_SESSION_CLOCK");
});
