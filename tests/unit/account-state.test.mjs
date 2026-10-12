import { expect, test, vi } from "vitest";
import { createAccountStateService } from "../../apps/api/dist/modules/identity/index.js";
const ref = { accountId: "fixture-owner", sessionId: "fixture-session" };
const command = {
  targetAccountId: "fixture-target",
  expectedRevision: 1,
  operation: "suspend",
};
const owner = {
  profile: "owner",
  ownerCurrent: true,
  lifecycle: "active",
  sessionValid: true,
  securityLocked: false,
  resetRequired: false,
  grants: [],
};
function setup() {
  const data = {
    actor: owner,
    target: {
      id: command.targetAccountId,
      profile: "clinic",
      revision: 1,
      lifecycle: "active",
      hasCredential: true,
      securityLocked: false,
      resetRequired: false,
    },
  };
  const ports = {
    loadCurrent: vi.fn(async () => data),
    applyAtomic: vi.fn().mockResolvedValue("applied"),
  };
  return { data, ports, service: createAccountStateService(ports) };
}
test("clinic suspension requests account/clinic block, epoch/session/invitation revocation atomically", async () => {
  const { ports, service } = setup();
  expect(await service.change(ref, command)).toEqual({
    kind: "applied",
    recoveryRequired: false,
    invitationRequired: false,
  });
  expect(ports.applyAtomic.mock.calls[0][1].plan).toMatchObject({
    nextLifecycle: "suspended",
    clinicSuspended: true,
    incrementAuthEpoch: true,
    revokeSessions: true,
    revokePendingInvitations: true,
  });
});
test("owner only can secure clinic; no ordinary operation targets owner/admin or injects flags", async () => {
  const { data, ports, service } = setup();
  data.actor = {
    ...owner,
    profile: "admin",
    ownerCurrent: false,
    grants: ["clinics.manage"],
  };
  expect(
    await service.change(ref, { ...command, operation: "secure_clinic" }),
  ).toEqual({ kind: "denied" });
  data.actor = owner;
  for (const profile of ["owner", "admin", "unsupported"]) {
    data.target.profile = profile;
    expect(await service.change(ref, command)).toEqual({ kind: "denied" });
  }
  expect(
    await service.change(ref, { ...command, securityLocked: false }),
  ).toEqual({ kind: "invalid" });
  expect(ports.applyAtomic).not.toHaveBeenCalled();
});
test("secure account plan locks/resets without changing clinic review or work history; no reactivation bypass", async () => {
  const { data, ports, service } = setup();
  expect(
    await service.change(ref, { ...command, operation: "secure_clinic" }),
  ).toMatchObject({ kind: "applied", recoveryRequired: true });
  const plan = ports.applyAtomic.mock.calls[0][1].plan;
  expect(plan).toMatchObject({
    securityLocked: true,
    resetRequired: true,
    nextLifecycle: "active",
    revokeSessions: true,
  });
  expect(plan).not.toHaveProperty("reviewState");
  expect(plan).not.toHaveProperty("orderStatus");
  data.target.securityLocked = true;
  expect(
    await service.change(ref, { ...command, operation: "reactivate" }),
  ).toEqual({ kind: "recovery_required" });
  expect(ports.applyAtomic).toHaveBeenCalledTimes(1);
});
test("reactivation preserves reset requirement, does not activate employee without credential", async () => {
  const { data, ports, service } = setup();
  data.target.profile = "employee";
  data.target.lifecycle = "suspended";
  data.target.hasCredential = false;
  expect(
    await service.change(ref, { ...command, operation: "reactivate" }),
  ).toMatchObject({ kind: "applied", invitationRequired: true });
  expect(ports.applyAtomic.mock.calls[0][1].plan.nextLifecycle).toBe("invited");
  data.target.profile = "clinic";
  data.target.hasCredential = true;
  data.target.resetRequired = true;
  expect(
    await service.change(ref, { ...command, operation: "reactivate" }),
  ).toMatchObject({ kind: "applied", recoveryRequired: true });
  expect(ports.applyAtomic.mock.calls[1][1].plan).not.toHaveProperty(
    "resetRequired",
  );
});
test("current distinct employee/clinic grant required; revoked session or wrong grant denied", async () => {
  const { data, ports, service } = setup();
  data.actor = {
    ...owner,
    profile: "admin",
    ownerCurrent: false,
    grants: ["employees.suspend"],
  };
  expect(await service.change(ref, command)).toEqual({ kind: "denied" });
  data.target.profile = "employee";
  expect((await service.change(ref, command)).kind).toBe("applied");
  data.actor.sessionValid = false;
  expect(await service.change(ref, command)).toEqual({ kind: "denied" });
  expect(ports.applyAtomic).toHaveBeenCalledTimes(1);
});
test("stale revision/authority at commit cannot report applied or retry", async () => {
  for (const result of ["stale", "denied"]) {
    const { ports, service } = setup();
    ports.applyAtomic.mockResolvedValue(result);
    expect(await service.change(ref, command)).toEqual({
      kind: result === "stale" ? "conflict" : "denied",
    });
    expect(ports.applyAtomic).toHaveBeenCalledTimes(1);
  }
});
