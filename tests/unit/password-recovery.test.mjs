import { expect, test, vi } from "vitest";
import {
  createPasswordRecoveryService,
  AuthenticationBusy,
} from "../../apps/api/dist/modules/identity/index.js";
function setup() {
  let timestamp = 1000;
  let record = null;
  let token;
  const ports = {
    admit: vi.fn().mockReturnValue(true),
    enqueueAtomic: vi.fn(async (input) => {
      token = input.token;
      record = {
        id: "fixture-recovery",
        accountId: "fixture-account",
        tokenDigest: input.digest,
        authEpoch: "1",
        currentAuthEpoch: "1",
        expiresAt: input.expiresAt,
        consumed: false,
        revoked: false,
        lifecycle: "active",
        securityLocked: false,
      };
    }),
    findByDigest: vi.fn(async () => record),
    hash: vi.fn().mockResolvedValue("fixture-hash-only"),
    resetAtomic: vi.fn(async () => {
      record.consumed = true;
      return "reset";
    }),
  };
  return {
    ports,
    service: createPasswordRecoveryService(
      ports,
      { tokenLifetimeMs: 5000 },
      () => timestamp,
    ),
    getToken: () => token,
    getRecord: () => record,
    setTime: (v) => {
      timestamp = v;
    },
  };
}
test("requests have generic response and no token/account existence DTO; canonicalization reused", async () => {
  const { ports, service, getToken } = setup();
  expect(
    await service.request(" Alias+tag@EXAMPLE.INVALID ", "fixture-network"),
  ).toEqual({ kind: "accepted" });
  expect(ports.enqueueAtomic.mock.calls[0][0].emailKey).toBe(
    "Alias+tag@example.invalid",
  );
  expect(getToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(ports.enqueueAtomic.mock.calls[0][0].digest).toHaveLength(32);
  ports.enqueueAtomic.mockResolvedValue(undefined);
  expect(
    await service.request("absent@example.invalid", "fixture-network"),
  ).toEqual({ kind: "accepted" });
  expect(await service.request("bad", "fixture-network")).toEqual({
    kind: "accepted",
  });
});
test("admission before lookup/hash/queue, including malformed tokens", async () => {
  const { ports, service } = setup();
  ports.admit.mockReturnValue(false);
  expect(
    await service.request("fake@example.invalid", "fixture-network"),
  ).toEqual({ kind: "limited" });
  expect(
    await service.reset("bad", "fake-password", "fixture-network"),
  ).toEqual({ kind: "limited" });
  expect(ports.enqueueAtomic).not.toHaveBeenCalled();
  expect(ports.findByDigest).not.toHaveBeenCalled();
  expect(ports.hash).not.toHaveBeenCalled();
});
test("one-time reset passes hash only and epoch precondition to atomic writer; replay denied", async () => {
  const { ports, service, getToken } = setup();
  await service.request("fake@example.invalid", "fixture-network");
  expect(
    await service.reset(getToken(), "fixture-password", "fixture-network"),
  ).toEqual({ kind: "reset" });
  expect(ports.resetAtomic.mock.calls[0][0]).toMatchObject({
    accountId: "fixture-account",
    expectedAuthEpoch: "1",
    passwordHash: "fixture-hash-only",
  });
  expect(ports.resetAtomic.mock.calls[0][0]).not.toHaveProperty("password");
  expect(
    await service.reset(getToken(), "fixture-password", "fixture-network"),
  ).toEqual({ kind: "denied" });
  expect(ports.resetAtomic).toHaveBeenCalledTimes(1);
});
test("expired/revoked/consumed/epoch-obsolete/locked/suspended token cannot hash or reset", async () => {
  for (const patch of [
    { expiresAt: 1000 },
    { revoked: true },
    { consumed: true },
    { currentAuthEpoch: "2" },
    { securityLocked: true },
    { lifecycle: "suspended" },
    { lifecycle: "invited" },
    { tokenDigest: Buffer.alloc(32) },
  ]) {
    const { ports, service, getToken, getRecord } = setup();
    await service.request("fake@example.invalid", "fixture-network");
    Object.assign(getRecord(), patch);
    expect(
      await service.reset(getToken(), "fixture-password", "fixture-network"),
    ).toEqual({ kind: "denied" });
    expect(ports.hash).not.toHaveBeenCalled();
    expect(ports.resetAtomic).not.toHaveBeenCalled();
  }
});
test("expiry during KDF or concurrency denial cannot report success", async () => {
  const { ports, service, getToken, setTime } = setup();
  await service.request("fake@example.invalid", "fixture-network");
  ports.hash.mockImplementation(async () => {
    setTime(6000);
    return "fixture-hash-only";
  });
  expect(
    await service.reset(getToken(), "fixture-password", "fixture-network"),
  ).toEqual({ kind: "denied" });
  expect(ports.resetAtomic).not.toHaveBeenCalled();
  const next = setup();
  await next.service.request("fake@example.invalid", "fixture-network");
  next.ports.resetAtomic.mockResolvedValue("denied");
  expect(
    await next.service.reset(
      next.getToken(),
      "fixture-password",
      "fixture-network",
    ),
  ).toEqual({ kind: "denied" });
});
test("KDF busy and invalid password become safe errors; infrastructure failures do not become success", async () => {
  const { ports, service, getToken } = setup();
  await service.request("fake@example.invalid", "fixture-network");
  ports.hash.mockRejectedValue(new AuthenticationBusy());
  expect(
    await service.reset(getToken(), "fixture-password", "fixture-network"),
  ).toEqual({ kind: "limited" });
  ports.hash.mockRejectedValue(new Error("INVALID_NEW_PASSWORD"));
  expect(
    await service.reset(getToken(), "fixture-password", "fixture-network"),
  ).toEqual({ kind: "invalid" });
  ports.hash.mockRejectedValue(new Error("PASSWORD_KDF_FAILED"));
  await expect(
    service.reset(getToken(), "fixture-password", "fixture-network"),
  ).rejects.toThrow("PASSWORD_KDF_FAILED");
  expect(ports.resetAtomic).not.toHaveBeenCalled();
});
test("malformed proof, invalid policy or backwards clock fail closed", async () => {
  const { ports, service, getToken, setTime } = setup();
  expect(() =>
    createPasswordRecoveryService(ports, { tokenLifetimeMs: 0 }),
  ).toThrow("INVALID_RECOVERY_POLICY");
  await service.request("fake@example.invalid", "fixture-network");
  expect(
    await service.reset(
      getToken() + "=",
      "fixture-password",
      "fixture-network",
    ),
  ).toEqual({ kind: "denied" });
  setTime(999);
  await expect(
    service.reset(getToken(), "fixture-password", "fixture-network"),
  ).rejects.toThrow("INVALID_RECOVERY_CLOCK");
});
