import { test, expect, vi } from "vitest";
import {
  createAdminRepository,
  createAdminRuntimeService,
} from "../../apps/api/dist/modules/identity/index.js";
import { adminManagementEnabled } from "../../apps/api/dist/app/admin-management-config.js";
import { createAdminClient } from "../../apps/web/src/features/permissions/admin-api.ts";
const id = "72000000-0000-4000-8000-000000000001",
  targetId = "72000000-0000-4000-8000-000000000002";
const actor = { accountId: id, sessionId: id };
function fixture(patch = {}) {
  const query = vi.fn(async (sql) => {
    if (patch.fail && sql.startsWith(patch.fail)) throw new Error("INJECTED");
    if (sql.startsWith("SELECT s.id"))
      return { rows: patch.revoked ? [] : [{ id }] };
    if (sql.startsWith("SELECT a.id,a.profile,a.lifecycle"))
      return {
        rows: [
          {
            id,
            profile: patch.actorProfile ?? "owner",
            lifecycle: patch.actorLifecycle ?? "active",
            securityLocked: patch.actorLocked ?? false,
            resetRequired: patch.actorReset ?? false,
            sessionValid: true,
            ownerCurrent: patch.owner ?? true,
            grants: patch.grants ?? ["clinics.manage", "employees.suspend"],
          },
          {
            id: targetId,
            profile: patch.profile ?? "admin",
            revision: patch.revision ?? "1",
            lifecycle: patch.lifecycle ?? "active",
            securityLocked: patch.locked ?? false,
            resetRequired: patch.reset ?? false,
            grants: patch.targetGrants ?? [],
            hasCredential: patch.credential ?? true,
            email: "fixture@example.test",
            clinicId: targetId,
            clinicSuspended:
              patch.profile === "employee" ? null : (patch.suspended ?? false),
          },
        ],
      };
    if (sql.startsWith("SELECT suspended"))
      return { rows: [{ suspended: patch.suspended ?? false }] };
    if (sql.startsWith("UPDATE public.accounts"))
      return { rows: [{ id: targetId }] };
    return { rows: [] };
  });
  return { query, transaction: vi.fn(async (fn) => fn({ query })) };
}
const writes = (db) =>
  db.query.mock.calls.filter(([s]) => /^(INSERT|UPDATE|DELETE)/.test(s));

const command = { expected_revision: 1, operation: "suspend" };
test("admin integration disabled unless explicitly enabled with authentication", () => {
  expect(adminManagementEnabled({})).toBe(false);
  expect(() =>
    adminManagementEnabled({ DENTAL_LAB_ADMIN_MANAGEMENT_ENABLED: "true" }),
  ).toThrow();
  expect(
    adminManagementEnabled({
      DENTAL_LAB_ADMIN_MANAGEMENT_ENABLED: "true",
      DENTAL_LAB_AUTH_ENABLED: "true",
    }),
  ).toBe(true);
});
test("only the active current owner can read or mutate administrators", async () => {
  for (const patch of [
    { actorProfile: "admin" },
    { actorProfile: "employee" },
    { actorProfile: "clinic" },
    { owner: false },
    { revoked: true },
    { actorLifecycle: "suspended" },
    { actorLocked: true },
    { actorReset: true },
  ]) {
    const db = fixture(patch),
      store = createAdminRuntimeService(db);
    expect(await store.profile(actor, targetId)).toBeNull();
    expect(await store.list(actor)).toBeNull();
    expect(await store.history(actor, targetId)).toBeNull();
    expect(await store.change(actor, targetId, command)).toEqual({
      kind: "denied",
    });
    expect(writes(db)).toHaveLength(0);
  }
});
test("owner self-target, another owner, clinic and employee are never writable", async () => {
  for (const profile of ["owner", "clinic", "employee"]) {
    const db = fixture({ profile });
    expect(
      await createAdminRepository(db).change(actor, targetId, command),
    ).toEqual({ kind: "denied" });
    expect(writes(db)).toHaveLength(0);
  }
  const db = fixture();
  expect(await createAdminRepository(db).change(actor, id, command)).toEqual({
    kind: "denied",
  });
  expect(writes(db)).toHaveLength(0);
});
test("suspension binds revision, epoch, revocations, history, audit and outbox in one transaction", async () => {
  const db = fixture();
  expect(
    await createAdminRepository(db).change(actor, targetId, command),
  ).toMatchObject({ kind: "applied" });
  expect(db.transaction).toHaveBeenCalledTimes(1);
  expect(
    writes(db).find(([s]) => s.startsWith("UPDATE public.accounts"))[1],
  ).toEqual([targetId, "suspended", 1]);
  for (const table of [
    "sessions",
    "invitations",
    "admin_management_events",
    "audit_events",
    "outbox_events",
    "outbox_dispatches",
  ])
    expect(writes(db).some(([s]) => s.includes("public." + table))).toBe(true);
  expect(
    writes(db).some(([s]) =>
      /owner_slot|public.clinics|credentials|security_locked=|credential_reset_required=/.test(
        s,
      ),
    ),
  ).toBe(false);
});
test("reactivation preserves reset and security lock; no credential means invited, never active", async () => {
  const locked = fixture({ locked: true, lifecycle: "suspended" });
  expect(
    await createAdminRepository(locked).change(actor, targetId, {
      ...command,
      operation: "reactivate",
    }),
  ).toEqual({ kind: "recovery_required" });
  expect(writes(locked)).toHaveLength(0);
  const db = fixture({
    credential: false,
    reset: true,
    lifecycle: "suspended",
  });
  expect(
    await createAdminRepository(db).change(actor, targetId, {
      ...command,
      operation: "reactivate",
    }),
  ).toMatchObject({
    kind: "applied",
    recoveryRequired: true,
    invitationRequired: true,
  });
  expect(
    writes(db).find(([s]) => s.startsWith("UPDATE public.accounts"))[1][1],
  ).toBe("invited");
});
test("permission registry, dependencies, revision and injected fields are enforced", async () => {
  for (const patch of [
    { permission_codes: ["orders.read_details"] },
    { permission_codes: ["owner.transfer"] },
    { permission_codes: ["clinics.manage", "clinics.manage"] },
    { expected_revision: 2 },
    { profile: "owner" },
  ]) {
    const db = fixture();
    expect(
      (
        await createAdminRepository(db).change(actor, targetId, {
          expected_revision: 1,
          operation: "permissions",
          permission_codes: [],
          ...patch,
        })
      ).kind,
    ).not.toBe("applied");
    expect(writes(db)).toHaveLength(0);
  }
});
test("permissions preserve unchanged attribution and dependent rights require explicit complete set", async () => {
  const db = fixture({ targetGrants: ["clinics.manage"] });
  expect(
    await createAdminRepository(db).change(actor, targetId, {
      expected_revision: 1,
      operation: "permissions",
      permission_codes: ["clinics.manage", "employees.suspend"],
    }),
  ).toMatchObject({ kind: "applied" });
  const inserts = writes(db).filter(([s]) =>
    s.startsWith("INSERT INTO public.account_grants"),
  );
  expect(inserts).toHaveLength(1);
  expect(inserts[0][1][1]).toBe("employees.suspend");
  expect(inserts[0][0]).toContain("'admin'");
  const noOp = fixture({ targetGrants: ["clinics.manage"] });
  await createAdminRepository(noOp).change(actor, targetId, {
    expected_revision: 1,
    operation: "permissions",
    permission_codes: ["clinics.manage"],
  });
  expect(writes(noOp)).toHaveLength(0);
});
test("every write failure propagates without retry or success (SQL transport double, not rollback proof)", async () => {
  for (const fail of [
    "UPDATE public.accounts",
    "UPDATE public.sessions",
    "UPDATE public.invitations",
    "INSERT INTO public.admin_management_events",
    "INSERT INTO public.audit_events",
    "INSERT INTO public.outbox_events",
    "INSERT INTO public.outbox_dispatches",
  ]) {
    const db = fixture({ fail });
    await expect(
      createAdminRepository(db).change(actor, targetId, command),
    ).rejects.toThrow("INJECTED");
    expect(db.transaction).toHaveBeenCalledTimes(1);
  }
});
test("client never retries ambiguous writes and rejects late replies after abort", async () => {
  const controller = new globalThis.AbortController();
  const fetcher = vi.fn(async () => {
    controller.abort();
    return new globalThis.Response(JSON.stringify({ kind: "applied" }), {
      status: 200,
    });
  });
  await expect(
    createAdminClient(fetcher).change(targetId, command, controller.signal),
  ).rejects.toThrow("UNCERTAIN");
  expect(fetcher).toHaveBeenCalledTimes(1);
  const invalid = vi.fn();
  await expect(
    createAdminClient(invalid).profile(
      "bad",
      new globalThis.AbortController().signal,
    ),
  ).rejects.toThrow();
  expect(invalid).not.toHaveBeenCalled();
});

test("owner authority is reloaded after an earlier successful read", async () => {
  const patch = { owner: true };
  const db = fixture(patch);
  const service = createAdminRuntimeService(db);
  expect(await service.profile(actor, targetId)).toMatchObject({
    id: targetId,
    profile: "admin",
  });
  patch.owner = false;
  expect(await service.change(actor, targetId, command)).toEqual({
    kind: "denied",
  });
  expect(writes(db)).toHaveLength(0);
});
test("administrator history is scoped to target and bounded below a revision", async () => {
  const db = fixture();
  expect(await createAdminRepository(db).history(actor, targetId, 8)).toEqual({
    items: [],
    next_before: null,
  });
  const call = db.query.mock.calls.find(([sql]) =>
    sql.includes("FROM public.admin_management_events"),
  );
  expect(call[1]).toEqual([targetId, 8]);
  expect(call[0]).toContain("LIMIT 51");
});
