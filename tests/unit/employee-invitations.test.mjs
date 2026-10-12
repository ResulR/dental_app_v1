import { expect, test, vi } from "vitest";
import {
  createEmployeeInvitationService,
  createActionToken,
  actionTokenDigest,
} from "../../apps/api/dist/modules/identity/index.js";
const actor = { accountId: "fixture-admin", profile: "admin" };
function setup() {
  let timestamp = 1000;
  let record = null;
  let token;
  const ports = {
    admit: vi.fn().mockReturnValue(true),
    authorize: vi.fn().mockResolvedValue(true),
    issueAtomic: vi.fn(async (_actor, input) => {
      token = input.token;
      record = {
        id: "fixture-invitation",
        accountId: "fixture-employee",
        accountRevision: 1,
        purpose: "employee",
        profile: "employee",
        lifecycle: "invited",
        securityLocked: false,
        targetEmail: input.emailOriginal,
        currentEmailKey: input.emailKey,
        tokenDigest: input.digest,
        expiresAt: input.expiresAt,
        consumed: false,
        revoked: false,
      };
      return "invited";
    }),
    findByDigest: vi.fn(async () => record),
    hash: vi.fn().mockResolvedValue("fixture-hash-only"),
    activateAtomic: vi.fn(async () => {
      record.consumed = true;
      return "activated";
    }),
  };
  return {
    ports,
    service: createEmployeeInvitationService(
      ports,
      { invitationLifetimeMs: 5000 },
      () => timestamp,
    ),
    getToken: () => token,
    getRecord: () => record,
    setTime: (v) => {
      timestamp = v;
    },
  };
}
test("closed action-token purposes retain old digest algorithms and cannot substitute another flow", () => {
  const challenge = createActionToken("employee-invitation");
  expect(challenge.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(actionTokenDigest("employee-invitation", challenge.token)).toEqual(
    challenge.digest,
  );
  expect(actionTokenDigest("admin-invitation", challenge.token)).not.toEqual(
    challenge.digest,
  );
  expect(actionTokenDigest("password-recovery", challenge.token)).not.toEqual(
    challenge.digest,
  );
  expect(actionTokenDigest("email-change", challenge.token)).not.toEqual(
    challenge.digest,
  );
  expect(
    actionTokenDigest("employee-invitation", challenge.token + "="),
  ).toBeNull();
});
test("authorized issuer creates employee only, no public challenge/grant/session", async () => {
  const { ports, service, getToken } = setup();
  const result = await service.invite(
    actor,
    " Alias+tag@EXAMPLE.INVALID ",
    "fixture-network",
  );
  expect(result).toEqual({ kind: "invited" });
  expect(ports.authorize).toHaveBeenCalledWith(actor, "employees.create");
  expect(ports.issueAtomic.mock.calls[0][1]).toMatchObject({
    profile: "employee",
    emailKey: "Alias+tag@example.invalid",
    emailOriginal: "Alias+tag@EXAMPLE.INVALID",
  });
  expect(JSON.stringify(result)).not.toContain(getToken());
  expect(ports.issueAtomic.mock.calls[0][1]).not.toHaveProperty("permissions");
});
test("clinic/employee/unprivileged admin cannot invite; revoked grant and collision report no success", async () => {
  const { ports, service } = setup();
  for (const profile of ["employee", "clinic"])
    expect(
      await service.invite(
        { ...actor, profile },
        "fake@example.invalid",
        "fixture-network",
      ),
    ).toEqual({ kind: "denied" });
  ports.authorize.mockResolvedValue(false);
  expect(
    await service.invite(actor, "fake@example.invalid", "fixture-network"),
  ).toEqual({ kind: "denied" });
  expect(ports.issueAtomic).not.toHaveBeenCalled();
  ports.authorize.mockResolvedValue(true);
  ports.issueAtomic.mockResolvedValue("denied");
  expect(
    await service.invite(actor, "fake@example.invalid", "fixture-network"),
  ).toEqual({ kind: "denied" });
  ports.issueAtomic.mockResolvedValue("conflict");
  expect(
    await service.invite(actor, "fake@example.invalid", "fixture-network"),
  ).toEqual({ kind: "conflict" });
});
test("employee chooses password; only hash passed to atomic activation and replay denied", async () => {
  const { ports, service, getToken } = setup();
  await service.invite(actor, "fake@example.invalid", "fixture-network");
  expect(
    await service.accept(getToken(), "fixture-password", "fixture-network"),
  ).toEqual({ kind: "activated" });
  expect(ports.activateAtomic.mock.calls[0][0]).toMatchObject({
    accountId: "fixture-employee",
    expectedRevision: 1,
    passwordHash: "fixture-hash-only",
  });
  expect(ports.activateAtomic.mock.calls[0][0]).not.toHaveProperty("password");
  expect(
    await service.accept(getToken(), "fixture-password", "fixture-network"),
  ).toEqual({ kind: "denied" });
  expect(ports.activateAtomic).toHaveBeenCalledTimes(1);
});
test("wrong purpose/profile, changed email, activated/suspended/locked/expired/revoked invitations denied before KDF", async () => {
  for (const patch of [
    { purpose: "admin" },
    { profile: "admin" },
    { lifecycle: "active" },
    { lifecycle: "suspended" },
    { securityLocked: true },
    { currentEmailKey: "different@example.invalid" },
    { expiresAt: 1000 },
    { revoked: true },
  ]) {
    const { ports, service, getToken, getRecord } = setup();
    await service.invite(actor, "fake@example.invalid", "fixture-network");
    Object.assign(getRecord(), patch);
    expect(
      await service.accept(getToken(), "fixture-password", "fixture-network"),
    ).toEqual({ kind: "denied" });
    expect(ports.hash).not.toHaveBeenCalled();
    expect(ports.activateAtomic).not.toHaveBeenCalled();
  }
});
test("network limit precedes lookup; expiry during KDF and atomic race do not activate", async () => {
  const { ports, service, getToken, setTime } = setup();
  ports.admit.mockReturnValue(false);
  expect(
    await service.accept("bad", "fixture-password", "fixture-network"),
  ).toEqual({ kind: "limited" });
  expect(ports.findByDigest).not.toHaveBeenCalled();
  ports.admit.mockReturnValue(true);
  await service.invite(actor, "fake@example.invalid", "fixture-network");
  ports.hash.mockImplementation(async () => {
    setTime(6000);
    return "fixture-hash-only";
  });
  expect(
    await service.accept(getToken(), "fixture-password", "fixture-network"),
  ).toEqual({ kind: "denied" });
  expect(ports.activateAtomic).not.toHaveBeenCalled();
  const other = setup();
  await other.service.invite(actor, "fake@example.invalid", "fixture-network");
  other.ports.activateAtomic.mockResolvedValue("denied");
  expect(
    await other.service.accept(
      other.getToken(),
      "fixture-password",
      "fixture-network",
    ),
  ).toEqual({ kind: "denied" });
});

test("existing email/recovery token domains pinned for backward compatibility", () => {
  const token = Buffer.alloc(32, 7).toString("base64url");
  expect(actionTokenDigest("email-change", token).toString("hex")).toBe(
    "f62734447eac71b8ebfbb1f7c69444d678617d82671b6d7c3ec7af94ee1c43d0",
  );
  expect(actionTokenDigest("password-recovery", token).toString("hex")).toBe(
    "f366ca1c4b23d7be6f43f1bbb8ace67edfff0b8a539a5f888cd01061f73d0afb",
  );
});
