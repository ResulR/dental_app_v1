import { expect, test, vi } from "vitest";
import {
  planEmployeeGrantChange,
  createEmployeeDelegationService,
} from "../../apps/api/dist/modules/permissions/index.js";
const actor = {
  profile: "admin",
  lifecycle: "active",
  sessionValid: true,
  securityLocked: false,
  resetRequired: false,
  grants: ["employees.manage_permissions"],
};
const owner = { ...actor, profile: "owner", ownerCurrent: true, grants: [] };
const ref = { accountId: "fixture-admin", sessionId: "fixture-session" };
function setup() {
  const ports = {
    loadCurrent: vi.fn().mockResolvedValue({
      actor,
      envelope: ["orders.read_details"],
      target: {
        id: "fixture-employee",
        profile: "employee",
        revision: 1,
        grants: ["orders.read_logistics"],
      },
    }),
    applyAtomic: vi.fn().mockResolvedValue("applied"),
  };
  return { ports, service: createEmployeeDelegationService(ports) };
}
const command = {
  targetAccountId: "fixture-employee",
  expectedRevision: 1,
  permissionCodes: ["orders.read_logistics", "orders.read_details"],
};
test("admin can only change delegated employee rights; untouched owner-assigned grants preserved", () => {
  expect(
    planEmployeeGrantChange(
      actor,
      ["orders.read_details"],
      ["orders.read_logistics"],
      ["orders.read_logistics", "orders.read_details"],
    ),
  ).toMatchObject({ kind: "ready" });
  expect(
    planEmployeeGrantChange(
      actor,
      ["orders.read_details"],
      ["orders.read_logistics"],
      ["files.download"],
    ),
  ).toEqual({ kind: "denied" });
  expect(planEmployeeGrantChange(actor, [], ["files.view"], [])).toEqual({
    kind: "denied",
  });
});
test("missing prerequisite on new grant, duplicate/unknown/admin authority grant invalid", () => {
  for (const desired of [
    ["orders.read_details"],
    ["files.view", "files.view"],
    ["owner"],
    ["employees.create"],
  ])
    expect(planEmployeeGrantChange(owner, [], [], desired)).toEqual({
      kind: "invalid",
    });
});
test("prerequisite removal previews dependent drops; every resulting change must be delegated", () => {
  const current = [
    "orders.read_logistics",
    "orders.read_details",
    "orders.accept",
  ];
  const desired = ["orders.read_details", "orders.accept"];
  expect(
    planEmployeeGrantChange(actor, ["orders.read_logistics"], current, desired),
  ).toEqual({ kind: "denied" });
  expect(planEmployeeGrantChange(actor, current, current, desired)).toEqual({
    kind: "ready",
    permissions: [],
    dropped: ["orders.read_details", "orders.accept"],
  });
});
test("unprivileged, stale owner, suspended or revoked session cannot change delegation target", () => {
  for (const patch of [
    { profile: "employee" },
    { profile: "clinic" },
    { grants: [] },
    { sessionValid: false },
    { lifecycle: "suspended" },
    { securityLocked: true },
  ])
    expect(
      planEmployeeGrantChange(
        { ...actor, ...patch },
        ["files.view"],
        [],
        ["files.view"],
      ),
    ).toEqual({ kind: "denied" });
  expect(
    planEmployeeGrantChange(
      { ...owner, ownerCurrent: false },
      [],
      [],
      ["files.view"],
    ),
  ).toEqual({ kind: "denied" });
});
test("client cannot inject owner context or delegation envelope, target admin or forge stale revision", async () => {
  const { ports, service } = setup();
  for (const patch of [
    { actorProfile: "owner" },
    { envelope: ["files.download"] },
  ])
    expect(await service.change(ref, { ...command, ...patch })).toEqual({
      kind: "invalid",
    });
  expect(ports.loadCurrent).not.toHaveBeenCalled();
  ports.loadCurrent.mockResolvedValue({
    actor,
    envelope: ["orders.read_details"],
    target: {
      id: "fixture-employee",
      profile: "admin",
      revision: 1,
      grants: ["orders.read_logistics"],
    },
  });
  expect(await service.change(ref, command)).toEqual({ kind: "denied" });
  const next = setup();
  expect(
    await next.service.change(ref, { ...command, expectedRevision: 2 }),
  ).toEqual({ kind: "conflict" });
  expect(next.ports.applyAtomic).not.toHaveBeenCalled();
});
test("dependent removals require exact explicit confirmation before mutation", async () => {
  const { ports, service } = setup();
  const grants = [
    "orders.read_logistics",
    "orders.read_details",
    "orders.accept",
  ];
  ports.loadCurrent.mockResolvedValue({
    actor,
    envelope: grants,
    target: {
      id: "fixture-employee",
      profile: "employee",
      revision: 1,
      grants,
    },
  });
  const request = {
    ...command,
    permissionCodes: ["orders.read_details", "orders.accept"],
  };
  expect(await service.change(ref, request)).toEqual({
    kind: "confirmation_required",
    droppedCodes: ["orders.read_details", "orders.accept"],
  });
  expect(ports.applyAtomic).not.toHaveBeenCalled();
  expect(
    await service.change(ref, {
      ...request,
      confirmedDroppedCodes: ["orders.read_details", "orders.accept"],
    }),
  ).toEqual({ kind: "applied" });
  expect(ports.applyAtomic.mock.calls[0][1].proposedPermissionCodes).toEqual(
    [],
  );
  expect(ports.applyAtomic.mock.calls[0][1].permissionCodes).toEqual([
    "orders.read_details",
    "orders.accept",
  ]);
});
test("revocation at commit or stale revision reported without retry/success", async () => {
  for (const result of ["denied", "stale"]) {
    const { ports, service } = setup();
    ports.applyAtomic.mockResolvedValue(result);
    expect(await service.change(ref, command)).toEqual({
      kind: result === "stale" ? "conflict" : "denied",
    });
    expect(ports.applyAtomic).toHaveBeenCalledTimes(1);
  }
});
