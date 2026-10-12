import { expect, test, vi } from "vitest";
import {
  createAdminManagementService,
  createAdminInvitationService,
} from "../../apps/api/dist/modules/identity/index.js";
const owner = { accountId: "fixture-owner", profile: "owner" };
const command = {
  targetAccountId: "fixture-admin",
  expectedRevision: 1,
  operation: "suspend",
};
function setup() {
  const ports = {
    authorizeOwner: vi.fn().mockResolvedValue(true),
    readTarget: vi
      .fn()
      .mockResolvedValue({ id: command.targetAccountId, profile: "admin" }),
    validatePermissions: vi.fn().mockResolvedValue(true),
    mutateAtomic: vi.fn().mockResolvedValue("applied"),
  };
  return { ports, service: createAdminManagementService(ports) };
}
test("no secondary admin, employee or clinic can manage any admin including itself", async () => {
  const { ports, service } = setup();
  for (const profile of ["admin", "employee", "clinic"])
    expect(
      await service.manage({ accountId: "fixture-other", profile }, command),
    ).toEqual({ kind: "denied" });
  expect(ports.authorizeOwner).not.toHaveBeenCalled();
  expect(ports.mutateAtomic).not.toHaveBeenCalled();
  expect(
    await service.manage(owner, {
      ...command,
      targetAccountId: owner.accountId,
    }),
  ).toEqual({ kind: "denied" });
});
test("current owner and exact admin target required; owner slot and other profiles untouched", async () => {
  const { ports, service } = setup();
  ports.authorizeOwner.mockResolvedValue(false);
  expect(await service.manage(owner, command)).toEqual({ kind: "denied" });
  expect(ports.readTarget).not.toHaveBeenCalled();
  ports.authorizeOwner.mockResolvedValue(true);
  for (const profile of ["owner", "employee", "clinic"]) {
    ports.readTarget.mockResolvedValue({
      id: command.targetAccountId,
      profile,
    });
    expect(await service.manage(owner, command)).toEqual({ kind: "denied" });
  }
  expect(ports.mutateAtomic).not.toHaveBeenCalled();
  ports.readTarget.mockResolvedValue({
    id: command.targetAccountId,
    profile: "admin",
  });
  expect(await service.manage(owner, command)).toEqual({ kind: "applied" });
});
test("permission input cannot bypass registry/dependencies; stale or revoked owner at commit rejected", async () => {
  const { ports, service } = setup();
  const input = {
    ...command,
    operation: "permissions",
    permissionCodes: ["clinics.manage"],
  };
  ports.validatePermissions.mockResolvedValue(false);
  expect(await service.manage(owner, input)).toEqual({ kind: "invalid" });
  expect(ports.mutateAtomic).not.toHaveBeenCalled();
  ports.validatePermissions.mockResolvedValue(true);
  for (const result of ["stale", "denied"]) {
    ports.mutateAtomic.mockResolvedValue(result);
    expect(await service.manage(owner, input)).toEqual({
      kind: result === "stale" ? "conflict" : "denied",
    });
  }
});
test("unsafe revision, duplicate grant and injected profile rejected", async () => {
  const { ports, service } = setup();
  for (const input of [
    { ...command, expectedRevision: 0 },
    { ...command, profile: "owner" },
    {
      ...command,
      operation: "permissions",
      permissionCodes: ["clinics.manage", "clinics.manage"],
    },
  ])
    expect(await service.manage(owner, input)).toEqual({ kind: "invalid" });
  expect(ports.mutateAtomic).not.toHaveBeenCalled();
});
test("admin invitation only current owner, profile fixed admin and private challenge with separate scope", async () => {
  let invitation;
  const ports = {
    admit: () => true,
    authorizeOwner: vi.fn().mockResolvedValue(true),
    issueAtomic: vi.fn(async (_actor, input) => {
      invitation = input;
      return "invited";
    }),
    findByDigest: vi.fn(async (digest) => ({
      id: "fixture-invitation",
      accountId: "fixture-admin",
      accountRevision: 1,
      purpose: "admin",
      profile: "admin",
      lifecycle: "invited",
      securityLocked: false,
      targetEmail: invitation.emailOriginal,
      currentEmailKey: invitation.emailKey,
      tokenDigest: digest,
      expiresAt: 6000,
      consumed: false,
      revoked: false,
    })),
    activateAtomic: vi.fn().mockResolvedValue("activated"),
    hash: async () => "fixture-hash-only",
  };
  const service = createAdminInvitationService(
    ports,
    { invitationLifetimeMs: 5000 },
    () => 1000,
  );
  expect(
    await service.invite(
      { accountId: "fixture-admin", profile: "admin" },
      "fake@example.invalid",
      "fixture-network",
    ),
  ).toEqual({ kind: "denied" });
  expect(ports.issueAtomic).not.toHaveBeenCalled();
  expect(
    await service.invite(owner, "fake@example.invalid", "fixture-network"),
  ).toEqual({ kind: "invited" });
  expect(invitation.profile).toBe("admin");
  expect(
    await service.accept(
      invitation.token,
      "fixture-password",
      "fixture-network",
    ),
  ).toEqual({ kind: "activated" });
});

test("permission command is copied before asynchronous authorization to prevent alias mutation", async () => {
  const { ports, service } = setup();
  const input = {
    ...command,
    operation: "permissions",
    permissionCodes: ["clinics.manage"],
  };
  ports.authorizeOwner.mockImplementation(async () => {
    input.permissionCodes.push("injected");
    input.targetAccountId = "other";
    return true;
  });
  expect(await service.manage(owner, input)).toEqual({ kind: "applied" });
  expect(ports.readTarget).toHaveBeenCalledWith(command.targetAccountId);
  expect(ports.validatePermissions).toHaveBeenCalledWith(["clinics.manage"]);
  expect(ports.mutateAtomic.mock.calls[0][1].permissionCodes).toEqual([
    "clinics.manage",
  ]);
});
