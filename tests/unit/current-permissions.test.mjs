import { test, expect, vi } from "vitest";
import {
  createCurrentPermissionsRepository,
  permissionPrerequisites,
} from "../../apps/api/dist/modules/permissions/index.js";
import { PermissionCodeSchema } from "@dental-lab/contracts";
import { createAuthClient } from "../../apps/web/src/features/authentication/auth-api.ts";
const accountId = "70000000-0000-4000-8000-000000000001",
  sessionId = "70000000-0000-4000-8000-000000000002";
const base = {
  profile: "employee",
  lifecycle: "active",
  sessionValid: true,
  securityLocked: false,
  resetRequired: false,
  grants: ["clinics.manage"],
};
function store(rows) {
  const query = vi.fn(async () => ({ rows }));
  return { query, repository: createCurrentPermissionsRepository({ query }) };
}
test("public permission registry matches received server registry exactly", () => {
  expect(PermissionCodeSchema.options).toEqual(
    Object.keys(permissionPrerequisites),
  );
});
test("snapshot uses current SQL actor/session and prerequisite filtering, never writes", async () => {
  const { query, repository } = store([
    {
      ...base,
      grants: ["clinics.manage", "orders.read_details", "employees.create"],
    },
  ]);
  expect(
    await repository.current({
      accountId,
      sessionId,
      grants: ["settings.manage"],
    }),
  ).toEqual({
    account_id: accountId,
    profile: "employee",
    permissions: ["clinics.manage"],
  });
  expect(query).toHaveBeenCalledTimes(1);
  expect(query.mock.calls[0][1]).toEqual([accountId, sessionId]);
  const sql = query.mock.calls[0][0];
  for (const rule of [
    "s.revoked_at IS NULL",
    "s.auth_epoch=a.auth_epoch",
    "l.absolute_expires_at>statement_timestamp()",
    "g.account_id=a.id",
  ])
    expect(sql).toContain(rule);
  expect(sql).not.toMatch(/\b(UPDATE|INSERT|DELETE)\b/);
});
test("revoked, missing, locked, suspended, reset and obsolete owner contexts fail closed", async () => {
  for (const rows of [
    [],
    [base, base],
    [{ ...base, lifecycle: "suspended" }],
    [{ ...base, securityLocked: true }],
    [{ ...base, resetRequired: true }],
    [
      {
        ...base,
        profile: "clinic",
        clinicId: accountId,
        clinicSuspended: true,
      },
    ],
    [{ ...base, profile: "clinic", clinicSuspended: false }],
    [{ ...base, profile: "owner", ownerCurrent: false }],
  ]) {
    expect(
      await store(rows).repository.current({ accountId, sessionId }),
    ).toBeNull();
  }
});
test("only current owner receives registry; clinic receives no delegable rights", async () => {
  expect(
    (
      await store([
        { ...base, profile: "owner", ownerCurrent: true },
      ]).repository.current({ accountId, sessionId })
    ).permissions,
  ).toEqual(PermissionCodeSchema.options);
  expect(
    (
      await store([
        {
          ...base,
          profile: "clinic",
          clinicId: accountId,
          clinicSuspended: false,
        },
      ]).repository.current({ accountId, sessionId })
    ).permissions,
  ).toEqual([]);
});
test("new reads observe revocation without cached grants", async () => {
  const rows = [{ ...base }];
  const { repository } = store(rows);
  expect(
    (await repository.current({ accountId, sessionId })).permissions,
  ).toContain("clinics.manage");
  rows[0] = { ...base, grants: [] };
  expect(
    (await repository.current({ accountId, sessionId })).permissions,
  ).toEqual([]);
});
test("permission transport is bounded same-origin and fails closed without retry", async () => {
  const snapshot = {
    account_id: accountId,
    profile: "employee",
    permissions: ["clinics.manage"],
  };
  const transport = vi.fn(
    async () => new globalThis.Response(JSON.stringify(snapshot), { status: 200 }),
  );
  expect(await createAuthClient(transport).permissions()).toEqual(snapshot);
  expect(transport.mock.calls[0][1]).toMatchObject({
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
  });
  for (const payload of [
    { ...snapshot, permissions: ["admins.manage"] },
    { ...snapshot, secret: "extra" },
  ]) {
    expect(
      await createAuthClient(
        async () => new globalThis.Response(JSON.stringify(payload)),
      ).permissions(),
    ).toBeNull();
  }
  const fail = vi.fn(async () => {
    throw new Error("NETWORK");
  });
  expect(await createAuthClient(fail).permissions()).toBeNull();
  expect(fail).toHaveBeenCalledTimes(1);
});
