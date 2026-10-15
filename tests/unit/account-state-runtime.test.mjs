import { test, expect, vi } from "vitest";
import {
  createAccountStateRepository,
  createAccountStateRuntimeService,
} from "../../apps/api/dist/modules/identity/index.js";
import { accountStateEnabled } from "../../apps/api/dist/app/account-state-config.js";
import { createAccountStateClient } from "../../apps/web/src/features/permissions/account-state-api.ts";
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
            profile: patch.actorProfile ?? "admin",
            lifecycle: "active",
            securityLocked: false,
            resetRequired: false,
            sessionValid: true,
            ownerCurrent: patch.owner ?? false,
            grants: patch.grants ?? ["clinics.manage", "employees.suspend"],
          },
          {
            id: targetId,
            profile: patch.profile ?? "clinic",
            revision: patch.revision ?? "1",
            lifecycle: patch.lifecycle ?? "active",
            securityLocked: patch.locked ?? false,
            resetRequired: patch.reset ?? false,
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
test("account state flag requires explicit auth, remains disabled by default", () => {
  expect(accountStateEnabled({})).toBe(false);
  expect(() =>
    accountStateEnabled({ DENTAL_LAB_ACCOUNT_STATE_ENABLED: "true" }),
  ).toThrow();
});
test("suspend clinic writes flags, epoch, session/invitation revocation, history and audit in one transaction", async () => {
  const db = fixture();
  expect(
    await createAccountStateRepository(db).applyAtomic(actor, {
      targetAccountId: targetId,
      expectedRevision: 1,
      operation: "suspend",
    }),
  ).toBe("applied");
  expect(db.transaction).toHaveBeenCalledTimes(1);
  expect(
    writes(db).find(([s]) => s.startsWith("UPDATE public.accounts"))[1],
  ).toEqual([targetId, "suspended", false, 1]);
  expect(
    writes(db).find(([s]) => s.startsWith("UPDATE public.clinics"))[1],
  ).toEqual([targetId, true]);
  expect(
    writes(db).some(([s]) => s.startsWith("UPDATE public.invitations")),
  ).toBe(true);
  expect(
    writes(db).some(([s]) =>
      /review_state|password_hash|email_original|account_grants/.test(s),
    ),
  ).toBe(false);
  const event = writes(db).find(([s]) =>
    s.includes("INSERT INTO public.account_state_events"),
  );
  expect(JSON.parse(event[1][7])).toMatchObject({
    lifecycle: "suspended",
    clinic_suspended: true,
    security_locked: false,
  });
});
test("reactivation cannot unlock security, preserves reset, never revives old invitations", async () => {
  const locked = fixture({ lifecycle: "suspended", locked: true });
  expect(
    await createAccountStateRuntimeService(locked).change(actor, targetId, {
      expected_revision: 1,
      operation: "reactivate",
    }),
  ).toEqual({ kind: "recovery_required" });
  expect(writes(locked)).toHaveLength(0);
  const reset = fixture({
    lifecycle: "suspended",
    reset: true,
    suspended: true,
  });
  expect(
    await createAccountStateRuntimeService(reset).change(actor, targetId, {
      expected_revision: 1,
      operation: "reactivate",
    }),
  ).toMatchObject({ kind: "applied", recoveryRequired: true });
  expect(
    writes(reset).find(([s]) => s.startsWith("UPDATE public.accounts"))[1],
  ).toEqual([targetId, "active", false, 1]);
  expect(writes(reset).some(([s]) => s.includes("public.invitations"))).toBe(
    false,
  );
});
test("employee without credential remains invited after reactivation", async () => {
  const db = fixture({
    profile: "employee",
    lifecycle: "suspended",
    credential: false,
  });
  expect(
    await createAccountStateRuntimeService(db).change(actor, targetId, {
      expected_revision: 1,
      operation: "reactivate",
    }),
  ).toMatchObject({ kind: "applied", invitationRequired: true });
  expect(
    writes(db).find(([s]) => s.startsWith("UPDATE public.accounts"))[1][1],
  ).toBe("invited");
  expect(writes(db).some(([s]) => s.includes("public.clinics"))).toBe(false);
});
test("secure clinic is owner-only and does not change clinic approval or suspension", async () => {
  const denied = fixture();
  expect(
    await createAccountStateRuntimeService(denied).change(actor, targetId, {
      expected_revision: 1,
      operation: "secure_clinic",
    }),
  ).toEqual({ kind: "denied" });
  expect(writes(denied)).toHaveLength(0);
  const db = fixture({ actorProfile: "owner", owner: true });
  expect(
    await createAccountStateRuntimeService(db).change(actor, targetId, {
      expected_revision: 1,
      operation: "secure_clinic",
    }),
  ).toMatchObject({ kind: "applied", recoveryRequired: true });
  expect(
    writes(db).find(([s]) => s.startsWith("UPDATE public.accounts"))[1],
  ).toEqual([targetId, "active", true, 1]);
  expect(writes(db).some(([s]) => s.includes("UPDATE public.clinics"))).toBe(
    false,
  );
  const event = writes(db).find(([s]) =>
    s.includes("INSERT INTO public.account_state_events"),
  );
  expect(JSON.parse(event[1][7])).toMatchObject({
    security_locked: true,
    reset_required: true,
    lifecycle: "active",
    clinic_suspended: false,
  });
});
test("revoked authority/session, stale revision, owner/admin target and client flags are refused", async () => {
  for (const patch of [
    { grants: [] },
    { revoked: true },
    { profile: "owner" },
    { profile: "admin" },
    { revision: "2" },
  ]) {
    const db = fixture(patch);
    const result = await createAccountStateRuntimeService(db).change(
      actor,
      targetId,
      { expected_revision: 1, operation: "suspend" },
    );
    expect(result.kind).toBe(patch.revision ? "conflict" : "denied");
    expect(writes(db)).toHaveLength(0);
  }
  const db = fixture();
  expect(
    await createAccountStateRuntimeService(db).change(actor, targetId, {
      expected_revision: 1,
      operation: "suspend",
      security_locked: false,
    }),
  ).toEqual({ kind: "invalid" });
  expect(db.transaction).not.toHaveBeenCalled();
});
test("concurrent authority removal is recomputed and persistence errors are never retried", async () => {
  const patch = {},
    db = fixture(patch);
  let n = 0;
  db.transaction.mockImplementation(async (fn) => {
    if (++n === 2) patch.grants = [];
    return fn({ query: db.query });
  });
  expect(
    await createAccountStateRuntimeService(db).change(actor, targetId, {
      expected_revision: 1,
      operation: "suspend",
    }),
  ).toEqual({ kind: "denied" });
  expect(writes(db)).toHaveLength(0);
  for (const fail of [
    "UPDATE public.accounts",
    "UPDATE public.clinics",
    "UPDATE public.sessions",
    "UPDATE public.invitations",
    "INSERT INTO public.account_state_events",
    "INSERT INTO public.audit_events",
    "INSERT INTO public.outbox_events",
    "INSERT INTO public.outbox_dispatches",
  ]) {
    const failed = fixture({ fail });
    await expect(
      createAccountStateRepository(failed).applyAtomic(actor, {
        targetAccountId: targetId,
        expectedRevision: 1,
        operation: "suspend",
      }),
    ).rejects.toThrow("INJECTED");
    expect(failed.transaction).toHaveBeenCalledTimes(1);
  }
});
test("state transport refuses invalid paths and never acknowledges an aborted result", async () => {
  const c = new globalThis.AbortController(),
    transport = vi.fn(async () => {
      c.abort();
      return new globalThis.Response(
        JSON.stringify({
          kind: "applied",
          recoveryRequired: false,
          invitationRequired: false,
        }),
      );
    });
  const client = createAccountStateClient(transport);
  await expect(client.profile("bad", c.signal)).rejects.toThrow("INVALID");
  expect(transport).not.toHaveBeenCalled();
  await expect(
    client.change(
      targetId,
      { expected_revision: 1, operation: "suspend" },
      c.signal,
    ),
  ).rejects.toThrow("UNCERTAIN");
  expect(transport).toHaveBeenCalledTimes(1);
});
