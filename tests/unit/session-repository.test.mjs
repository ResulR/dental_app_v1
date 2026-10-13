import { expect, test, vi } from "vitest";
import { createSessionRepository } from "../../apps/api/dist/modules/identity/session.repository.js";
const accountId = "10000000-0000-4000-8000-000000000001";
const sessionId = "10000000-0000-4000-8000-000000000002";
const at = 1800000000000;
const write = () => ({
  fact: {
    kind: "authenticated",
    accountId,
    profile: "employee",
    authEpoch: "4",
  },
  digest: Buffer.alloc(32, 7),
  createdAt: at,
  expiresAt: at + 60000,
  absoluteExpiresAt: at + 120000,
});
const active = {
  profile: "employee",
  lifecycle: "active",
  security_locked: false,
  credential_reset_required: false,
  auth_epoch: "4",
};
function fixture(options = {}) {
  const events = [];
  const query = vi.fn(async (sql, values) => {
    events.push({ sql, values });
    if (options.fail && sql.includes(options.fail))
      throw new Error("injected failure");
    if (sql.includes("FROM public.accounts WHERE"))
      return {
        rows: options.missing ? [] : [{ ...active, ...options.account }],
        rowCount: options.missing ? 0 : 1,
      };
    if (sql.startsWith("SELECT suspended"))
      return {
        rows: options.clinicMissing
          ? []
          : [{ suspended: options.suspended ?? false }],
        rowCount: 1,
      };
    if (sql.startsWith("SELECT account_id"))
      return { rows: [], rowCount: options.ownerMissing ? 0 : 1 };
    if (sql.includes("UPDATE public.sessions s"))
      return { rows: [], rowCount: options.lostRace ? 0 : 1 };
    if (sql.includes("INSERT INTO public.sessions") && options.elapsed)
      return { rows: [], rowCount: 0 };
    return { rows: [], rowCount: 1 };
  });
  let committed = [];
  const database = {
    query,
    transaction: vi.fn(async (work) => {
      const start = events.length;
      const result = await work({ query });
      committed.push(...events.slice(start));
      return result;
    }),
  };
  return {
    repository: createSessionRepository(database),
    database,
    query,
    events,
    committed,
  };
}
test("issue locks and rechecks credential fact then writes session, limit and audit before commit", async () => {
  const f = fixture();
  const input = write();
  expect(await f.repository.issue(input)).toBe(true);
  expect(f.events.map((e) => e.sql)).toEqual([
    expect.stringContaining("FOR UPDATE"),
    expect.stringContaining("INSERT INTO public.sessions"),
    expect.stringContaining("INSERT INTO public.session_limits"),
    expect.stringContaining("INSERT INTO public.audit_events"),
  ]);
  expect(f.events[1].values).toEqual([
    expect.any(String),
    accountId,
    Buffer.alloc(32, 7),
    "4",
    new Date(at),
    new Date(at + 60000),
    null,
  ]);
  expect(f.events[2].values[0]).toBe(f.events[1].values[0]);
  expect(f.events[2].values[4]).toBe(f.events[1].values[0]);
  expect(f.events[3].values.slice(0, 2)).toEqual([accountId, "SESSION_ISSUED"]);
  expect(f.committed).toHaveLength(4);
});
test("post-KDF suspension, reset, lock, changed epoch/profile and missing account deny before insertion", async () => {
  for (const options of [
    { missing: true },
    { account: { lifecycle: "suspended" } },
    { account: { security_locked: true } },
    { account: { credential_reset_required: true } },
    { account: { auth_epoch: "5" } },
    { account: { profile: "admin" } },
  ]) {
    const f = fixture(options);
    expect(await f.repository.issue(write())).toBe(false);
    expect(f.events).toHaveLength(1);
  }
});
test("clinic and owner require their current matching records", async () => {
  for (const options of [{ suspended: true }, { clinicMissing: true }]) {
    const f = fixture({ ...options, account: { profile: "clinic" } });
    const input = write();
    input.fact.profile = "clinic";
    expect(await f.repository.issue(input)).toBe(false);
    expect(f.events[1].sql).toContain("FOR SHARE");
    expect(f.events).toHaveLength(2);
  }
  const f = fixture({ account: { profile: "owner" }, ownerMissing: true });
  const input = write();
  input.fact.profile = "owner";
  expect(await f.repository.issue(input)).toBe(false);
  expect(f.events).toHaveLength(2);
});
const old = () => ({
  id: sessionId,
  accountId,
  profile: "employee",
  authEpoch: "4",
  absoluteExpiresAt: at + 120000,
});
test("rotation conditionally consumes one parent and inherits its absolute boundary", async () => {
  const f = fixture();
  expect(await f.repository.rotate(old(), write())).toBe(true);
  expect(f.events[1].values).toEqual([
    sessionId,
    accountId,
    "4",
    new Date(at + 120000),
  ]);
  expect(f.events[1].sql).toContain("s.revoked_at IS NULL");
  expect(f.events[1].sql).toContain("l.absolute_expires_at=$4");
  expect(f.events[2].values[6]).toBe(sessionId);
  expect(f.events[3].values[4]).toBe(sessionId);
  expect(f.events[4].values[1]).toBe("SESSION_ROTATED");
  const loser = fixture({ lostRace: true });
  expect(await loser.repository.rotate(old(), write())).toBe(false);
  expect(loser.events).toHaveLength(2);
});
test("rotation rejects foreign account/epoch/profile and extension before transaction", async () => {
  for (const patch of [
    { accountId: sessionId },
    { authEpoch: "3" },
    { profile: "admin" },
    { absoluteExpiresAt: at + 130000 },
  ]) {
    const f = fixture();
    expect(await f.repository.rotate({ ...old(), ...patch }, write())).toBe(
      false,
    );
    expect(f.database.transaction).not.toHaveBeenCalled();
  }
});
test("failed limit/audit or elapsed window cannot commit rotation or issue", async () => {
  for (const options of [
    { fail: "INSERT INTO public.session_limits" },
    { fail: "INSERT INTO public.audit_events" },
    { elapsed: true },
  ]) {
    for (const rotation of [false, true]) {
      const f = fixture(options);
      await expect(
        rotation
          ? f.repository.rotate(old(), write())
          : f.repository.issue(write()),
      ).rejects.toThrow();
      expect(f.committed).toEqual([]);
    }
  }
});
test("revocations lock account first, targeted logout scopes IDs, global logout increments epoch", async () => {
  const one = fixture();
  await one.repository.revokeOne(accountId, sessionId);
  expect(one.events[0].sql).toContain("FOR UPDATE");
  expect(one.events[1].values).toEqual([sessionId, accountId]);
  expect(one.events[1].sql).toContain("account_id=$2");
  expect(one.events[2].values[1]).toBe("SESSION_REVOKED");
  const all = fixture();
  await all.repository.revokeAll(accountId);
  expect(all.events[0].sql).toContain("FOR UPDATE");
  expect(all.events[1].sql).toContain("auth_epoch=auth_epoch+1");
  expect(all.events[2].values).toEqual([accountId]);
  expect(all.events[3].values[1]).toBe("ALL_SESSIONS_REVOKED");
});
test("lookup maps milliseconds, retains live-state facts and uses only digest parameter", async () => {
  const database = {
    query: vi.fn().mockResolvedValue({
      rows: [
        {
          ...old(),
          currentAuthEpoch: "4",
          accountUsable: true,
          createdAt: String(at),
          expiresAt: String(at + 60000),
          absoluteExpiresAt: String(at + 120000),
          revokedAt: null,
        },
      ],
    }),
  };
  const repository = createSessionRepository(database);
  const result = await repository.find(Buffer.alloc(32, 9));
  expect(result.createdAt).toBe(at);
  expect(result.revokedAt).toBe(null);
  const [sql, values] = database.query.mock.calls[0];
  expect(sql).toContain("s.auth_epoch=a.auth_epoch");
  expect(sql).toContain("public.owner_slot");
  expect(sql).toContain("s.expires_at > clock_timestamp()");
  expect(values).toEqual([Buffer.alloc(32, 9)]);
  expect(await repository.find(Buffer.alloc(1))).toBeUndefined();
  expect(database.query).toHaveBeenCalledOnce();
});
test("write buffers and facts are copied before await and malformed durations fail closed", async () => {
  const f = fixture();
  const input = write();
  const pending = f.repository.issue(input);
  input.digest.fill(0);
  input.fact.authEpoch = "99";
  input.fact.accountId = sessionId;
  expect(await pending).toBe(true);
  expect(f.events[1].values[2]).toEqual(Buffer.alloc(32, 7));
  expect(f.events[1].values[1]).toBe(accountId);
  for (const patch of [
    { digest: Buffer.alloc(31) },
    { expiresAt: at },
    { absoluteExpiresAt: at + 60000 - 1 },
    { createdAt: NaN },
  ]) {
    const f = fixture();
    await expect(f.repository.issue({ ...write(), ...patch })).rejects.toThrow(
      "INVALID_SESSION_WRITE",
    );
    expect(f.database.transaction).not.toHaveBeenCalled();
  }
});
