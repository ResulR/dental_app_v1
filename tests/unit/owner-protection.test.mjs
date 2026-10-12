import { expect, test, vi } from "vitest";
import {
  hasOwnerPermission,
  permissionPrerequisites,
  validateGrantSet,
} from "../../apps/api/dist/modules/permissions/index.js";
import {
  createOwnerAccessService,
  createOwnerAccessRepository,
} from "../../apps/api/dist/modules/identity/index.js";
const actor = {
  accountId: "00000000-0000-4000-8000-000000000001",
  sessionId: "00000000-0000-4000-8000-000000000002",
};
const owner = {
  profile: "owner",
  lifecycle: "active",
  sessionValid: true,
  securityLocked: false,
  resetRequired: false,
  ownerCurrent: true,
  grants: [],
};
const actions = ["audit.read_global", "admins.manage", "clinics.secure"];
test("global audit and owner operations cannot be delegated even with every grant", () => {
  for (const action of actions) {
    expect(hasOwnerPermission(owner, action)).toBe(true);
    expect(validateGrantSet([action], "admin")).toBe(false);
    for (const profile of ["admin", "employee", "clinic", "unknown"])
      expect(
        hasOwnerPermission(
          {
            ...owner,
            profile,
            grants: Object.keys(permissionPrerequisites),
          },
          action,
        ),
      ).toBe(false);
  }
});
test("owner profile is insufficient with stale slot, session or security state", () => {
  for (const patch of [
    { ownerCurrent: false },
    { ownerCurrent: undefined },
    { ownerCurrent: "true" },
    { sessionValid: false },
    { lifecycle: "suspended" },
    { lifecycle: "invited" },
    { securityLocked: true },
    { resetRequired: true },
    { securityLocked: undefined },
  ])
    for (const action of actions)
      expect(hasOwnerPermission({ ...owner, ...patch }, action)).toBe(false);
});
test("even owner cannot request transfer, disabling owner, audit mutation or recovery bypass", () => {
  for (const action of [
    "owner.transfer",
    "owner.suspend",
    "owner.delete",
    "audit.update",
    "audit.delete",
    "owner.recover_exceptional",
    "toString",
    "__proto__",
    "",
    null,
    {},
    [],
  ])
    expect(hasOwnerPermission(owner, action)).toBe(false);
});
test("authorization reloads current state every time; revoked authority never cached", async () => {
  const loadCurrent = vi.fn().mockResolvedValue(owner);
  const service = createOwnerAccessService({ loadCurrent });
  expect(await service.authorize(actor, "audit.read_global")).toBe(true);
  loadCurrent.mockResolvedValue({ ...owner, ownerCurrent: false });
  expect(await service.authorize(actor, "audit.read_global")).toBe(false);
  loadCurrent.mockResolvedValue(null);
  expect(await service.authorize(actor, "admins.manage")).toBe(false);
  expect(loadCurrent).toHaveBeenCalledTimes(3);
});
test("invalid references and forbidden actions fail before lookup; errors never authorize", async () => {
  const loadCurrent = vi
    .fn()
    .mockRejectedValue(new Error("fixture-store-failure"));
  const service = createOwnerAccessService({ loadCurrent });
  expect(
    await service.authorize({ ...actor, accountId: "' OR true--" }, actions[0]),
  ).toBe(false);
  expect(await service.authorize({ ...actor, sessionId: "" }, actions[0])).toBe(
    false,
  );
  expect(await service.authorize(actor, "owner.transfer")).toBe(false);
  expect(loadCurrent).not.toHaveBeenCalled();
  await expect(service.authorize(actor, actions[0])).rejects.toThrow(
    "fixture-store-failure",
  );
});
test("current-context repository binds identities, projects no secrets and fails closed on cardinality", async () => {
  // SQL transport double: does not claim PostgreSQL predicate/concurrency validation.
  const query = vi.fn().mockResolvedValue({ rows: [owner] });
  const repository = createOwnerAccessRepository({ query });
  const service = createOwnerAccessService(repository);
  expect(await service.authorize(actor, "audit.read_global")).toBe(true);
  const [sql, values] = query.mock.calls[0];
  expect(values).toEqual([actor.accountId, actor.sessionId]);
  expect(sql).not.toContain(actor.accountId);
  for (const predicate of [
    "o.singleton=1 AND o.account_id=a.id",
    "s.revoked_at IS NULL",
    "s.auth_epoch=a.auth_epoch",
    "s.id=$2::uuid",
    "a.id=$1::uuid",
    "l.absolute_expires_at > statement_timestamp()",
  ])
    expect(sql).toContain(predicate);
  expect(sql).not.toMatch(/password_hash|secret_digest|SELECT\s+\*/i);
  for (const rows of [[], [owner, owner]]) {
    query.mockResolvedValue({ rows });
    expect(await service.authorize(actor, actions[0])).toBe(false);
  }
});
test("actor identity is copied and frozen across asynchronous lookups", async () => {
  const input = { ...actor, profile: "owner", ownerCurrent: true };
  let reference;
  const service = createOwnerAccessService({
    loadCurrent: async (received) => {
      reference = received;
      input.accountId = "changed";
      await Promise.resolve();
      return owner;
    },
  });
  expect(await service.authorize(input, actions[0])).toBe(true);
  expect(reference).toEqual(actor);
  expect(Object.isFrozen(reference)).toBe(true);
});
