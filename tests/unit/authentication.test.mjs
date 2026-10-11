import { expect, test, vi } from "vitest";
import {
  hashPassword,
  verifyPassword,
  AuthenticationBusy,
  createLoginLimiter,
  createAuthenticationService,
  createIdentityRepository,
  emailKey,
} from "../../apps/api/dist/modules/identity/index.js";

const password = "Fixture only — fjalëkalim 2026!";
test("real scrypt salts, verification and exact Unicode/whitespace", async () => {
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  expect(first).not.toEqual(second);
  expect(first).toMatch(/^scrypt\$1\$131072\$8\$1\$/);
  expect(await verifyPassword(password, first)).toBe(true);
  expect(await verifyPassword(password + " ", first)).toBe(false);
}, 60000);
test("strict records never execute attacker-controlled cost; bounded KDF concurrency", async () => {
  expect(
    await verifyPassword(password, "scrypt$1$999999999999$8$1$bad$bad"),
  ).toBe(false);
  expect(await verifyPassword("x".repeat(1025), undefined)).toBe(false);
  expect(await verifyPassword("\ud800", undefined)).toBe(false);
  await expect(hashPassword("short")).rejects.toThrow("INVALID_NEW_PASSWORD");
  const pending = hashPassword(password);
  await expect(hashPassword(password)).rejects.toBeInstanceOf(
    AuthenticationBusy,
  );
  await pending;
}, 60000);
test("email canonical domain only, provider aliases/local case preserved", () => {
  expect(emailKey("  A.B+lab@EXAMPLE.INVALID ")).toBe(
    "A.B+lab@example.invalid",
  );
  expect(emailKey("A@bücher.invalid")).toBe("A@xn--bcher-kva.invalid");
  expect(emailKey("a@example.invalid")).not.toBe(emailKey("A@example.invalid"));
  for (const value of [
    undefined,
    "bad",
    "a@@example.invalid",
    "a@-bad.invalid",
    "a b@example.invalid",
  ])
    expect(emailKey(value)).toBeNull();
});
test("account limit holds across rotating network keys and expires", () => {
  let at = 0;
  const gate = createLoginLimiter(
    { windowMs: 1000, accountAttempts: 2, networkAttempts: 3, maxKeys: 10 },
    () => at,
  );
  expect(gate.consume("same", "one").allowed).toBe(true);
  expect(gate.consume("same", "two").allowed).toBe(true);
  expect(gate.consume("same", "three")).toEqual({
    allowed: false,
    retryAfterSeconds: 1,
  });
  at = 1000;
  expect(gate.consume("same", "three").allowed).toBe(true);
});
test("network limit holds across rotating account keys; capacity and clock fail closed", () => {
  let at = 10;
  const gate = createLoginLimiter(
    { windowMs: 1000, accountAttempts: 3, networkAttempts: 2, maxKeys: 3 },
    () => at,
  );
  expect(gate.consume("one", "network").allowed).toBe(true);
  expect(gate.consume("two", "network").allowed).toBe(true);
  expect(gate.consume("three", "network").allowed).toBe(false);
  expect(gate.consume("four", "other").allowed).toBe(false);
  at = 9;
  expect(gate.consume("one", "network").allowed).toBe(false);
});
test("missing/invalid policy rejected; caller cannot mutate active policy", () => {
  for (const policy of [
    {},
    { windowMs: 0 },
    { windowMs: 1000, accountAttempts: 1, networkAttempts: 1, maxKeys: NaN },
  ])
    expect(() => createLoginLimiter(policy)).toThrow(
      "INVALID_LOGIN_LIMIT_POLICY",
    );
  const policy = {
    windowMs: 1000,
    accountAttempts: 1,
    networkAttempts: 2,
    maxKeys: 10,
  };
  const gate = createLoginLimiter(policy, () => 0);
  policy.accountAttempts = 100;
  expect(gate.consume("one", "network").allowed).toBe(true);
  expect(gate.consume("one", "network").allowed).toBe(false);
});
const account = {
  id: "10000000-0000-4000-8000-000000000002",
  profile: "clinic",
  lifecycle: "active",
  security_locked: false,
  credential_reset_required: false,
  clinic_suspended: false,
  auth_epoch: "0",
  password_hash: "fixture-hash-port-only",
};
test("valid credentials yield minimal fact, never hash/password/session", async () => {
  const findCredential = vi.fn().mockResolvedValue(account);
  const verify = vi.fn().mockResolvedValue(true);
  const service = createAuthenticationService({
    findCredential,
    verify,
    admit: () => ({ allowed: true }),
  });
  expect(
    await service.authenticate(
      "Clinic@EXAMPLE.INVALID",
      password,
      "trusted-network",
    ),
  ).toEqual({
    kind: "authenticated",
    accountId: account.id,
    profile: "clinic",
    authEpoch: "0",
  });
  expect(findCredential).toHaveBeenCalledWith("Clinic@example.invalid");
});
test("unknown, wrong and blocked accounts have same denial; verification still occurs", async () => {
  for (const [record, correct] of [
    [undefined, false],
    [account, false],
    [{ ...account, lifecycle: "suspended" }, true],
    [{ ...account, security_locked: true }, true],
    [{ ...account, credential_reset_required: true }, true],
    [{ ...account, clinic_suspended: true }, true],
    [{ ...account, auth_epoch: "bad" }, true],
  ]) {
    const verify = vi.fn().mockResolvedValue(correct);
    const service = createAuthenticationService({
      findCredential: async () => record,
      verify,
      admit: () => ({ allowed: true }),
    });
    expect(
      await service.authenticate(
        "clinic@example.invalid",
        password,
        "trusted-network",
      ),
    ).toEqual({ kind: "denied" });
    expect(verify).toHaveBeenCalledOnce();
  }
});
test("admission precedes expensive work; busy KDF is bounded backpressure", async () => {
  const findCredential = vi.fn();
  const verify = vi.fn();
  const service = createAuthenticationService({
    findCredential,
    verify,
    admit: () => ({ allowed: false, retryAfterSeconds: 10 }),
  });
  expect(
    await service.authenticate(
      "clinic@example.invalid",
      password,
      "trusted-network",
    ),
  ).toEqual({ kind: "limited", retryAfterSeconds: 10 });
  expect(findCredential).not.toHaveBeenCalled();
  expect(verify).not.toHaveBeenCalled();
  const busy = createAuthenticationService({
    findCredential: async () => account,
    admit: () => ({ allowed: true }),
    verify: async () => {
      throw new AuthenticationBusy();
    },
  });
  expect(
    await busy.authenticate(
      "clinic@example.invalid",
      password,
      "trusted-network",
    ),
  ).toEqual({ kind: "limited", retryAfterSeconds: 1 });
});
test("credential lookup parameterized; repository never opens a pool itself", async () => {
  const query = vi.fn().mockResolvedValue({ rows: [account] });
  const repository = createIdentityRepository({ query });
  const key = "fixture' OR true --@example.invalid";
  expect(await repository.findCredential(key)).toBe(account);
  const [sql, values] = query.mock.calls[0];
  expect(sql).toContain("WHERE a.email_key=$1");
  expect(sql).not.toContain(key);
  expect(values).toEqual([key]);
});
