import { test, expect, vi } from "vitest";
import {
  createDelegationRepository,
  createDelegationRuntimeService,
} from "../../apps/api/dist/modules/permissions/index.js";
import { delegationEnabled } from "../../apps/api/dist/app/delegation-config.js";
import { createDelegationClient } from "../../apps/web/src/features/permissions/delegation-api.ts";
const actorId = "71000000-0000-4000-8000-000000000001",
  targetId = "71000000-0000-4000-8000-000000000002";
const actor = { accountId: actorId, sessionId: actorId };
const input = {
  expected_revision: 1,
  permission_codes: ["orders.read_logistics", "orders.read_details"],
};
function fixture(patch = {}) {
  const query = vi.fn(async (sql, args) => {
    if (patch.fail && sql.startsWith(patch.fail))
      throw new Error("INJECTED_WRITE_FAILURE");
    if (sql.startsWith("SELECT s.id"))
      return { rows: patch.revoked ? [] : [{ id: actorId }] };
    if (sql.startsWith("SELECT a.id,a.profile"))
      return {
        rows: [
          {
            id: actorId,
            profile: patch.actorProfile ?? "admin",
            lifecycle: patch.lifecycle ?? "active",
            securityLocked: patch.locked ?? false,
            resetRequired: false,
            sessionValid: true,
            ownerCurrent: patch.owner ?? false,
            grants: patch.actorGrants ?? ["employees.manage_permissions"],
          },
          {
            id: targetId,
            profile: patch.targetProfile ?? "employee",
            revision: patch.revision ?? "1",
            email: "fixture@example.test",
            grants: patch.grants ?? ["orders.read_logistics"],
          },
        ],
      };
    if (sql.startsWith("SELECT permission_code"))
      return {
        rows: (args[0] === actorId
          ? (patch.envelope ?? ["orders.read_details"])
          : (patch.targetEnvelope ?? [])
        ).map((permission_code) => ({ permission_code })),
      };
    if (sql.startsWith("UPDATE public.accounts"))
      return { rows: [{ id: targetId }] };
    if (sql.startsWith("SELECT id,email_original")) return { rows: [] };
    if (sql.includes("FROM public.delegation_events")) return { rows: [] };
    return { rows: [] };
  });
  const transaction = vi.fn(async (fn) => fn({ query }));
  return { query, transaction, patch };
}
const writes = (db) =>
  db.query.mock.calls.filter(([sql]) => /^(INSERT|UPDATE|DELETE)/.test(sql));
test("delegation activation requires explicit flag and auth", () => {
  expect(delegationEnabled({})).toBe(false);
  expect(() =>
    delegationEnabled({ DENTAL_LAB_DELEGATION_ENABLED: "true" }),
  ).toThrow();
  expect(
    delegationEnabled({
      DENTAL_LAB_DELEGATION_ENABLED: "true",
      DENTAL_LAB_AUTH_ENABLED: "true",
    }),
  ).toBe(true);
});
test("one transaction preserves unchanged grants and includes revision, revocation, history, audit and outbox", async () => {
  const db = fixture();
  expect(
    await createDelegationRepository(db).applyAtomic(actor, {
      targetAccountId: targetId,
      expectedRevision: 1,
      permissionCodes: input.permission_codes,
    }),
  ).toBe("applied");
  expect(db.transaction).toHaveBeenCalledTimes(1);
  const sql = db.query.mock.calls.map(([s]) => s);
  expect(sql[0]).toContain("ORDER BY id FOR UPDATE");
  expect(sql[1]).toContain("SHARE ROW EXCLUSIVE");
  expect(sql.find((s) => s.startsWith("SELECT s.id"))).toContain(
    "s.auth_epoch=a.auth_epoch",
  );
  const inserts = writes(db).filter(([s]) =>
    s.startsWith("INSERT INTO public.account_grants"),
  );
  expect(inserts).toHaveLength(1);
  expect(inserts[0][1]).toEqual([
    targetId,
    "orders.read_details",
    "orders.read_logistics",
    actorId,
  ]);
  expect(writes(db).find(([s]) => s.startsWith("DELETE"))[1]).toEqual([
    targetId,
    input.permission_codes,
  ]);
  expect(sql).toContain(
    "UPDATE public.sessions SET revoked_at=GREATEST(clock_timestamp(),created_at) WHERE account_id=$1 AND revoked_at IS NULL",
  );
  const history = writes(db).find(([s]) =>
    s.includes("INSERT INTO public.delegation_events"),
  );
  expect(history[1].slice(-2)).toEqual([
    ["orders.read_logistics"],
    input.permission_codes,
  ]);
  expect(
    sql.filter((s) => s.startsWith("INSERT INTO public.audit_events")),
  ).toHaveLength(1);
  expect(
    sql.filter((s) => s.startsWith("INSERT INTO public.outbox_dispatches")),
  ).toHaveLength(1);
});
test("forbidden targets, revoked authority/envelope/session and stale revisions cause zero writes", async () => {
  for (const patch of [
    { actorProfile: "employee" },
    { actorProfile: "clinic" },
    { actorProfile: "owner", owner: false },
    { lifecycle: "suspended" },
    { locked: true },
    { actorGrants: [] },
    { envelope: [] },
    { revoked: true },
    { targetProfile: "admin" },
    { targetProfile: "owner" },
    { revision: "2" },
  ]) {
    const db = fixture(patch);
    expect(
      await createDelegationRepository(db).applyAtomic(actor, {
        targetAccountId: targetId,
        expectedRevision: 1,
        permissionCodes: input.permission_codes,
      }),
    ).toBe(patch.revision ? "stale" : "denied");
    expect(writes(db)).toHaveLength(0);
  }
});
test("permission revoked between load and apply is checked again by actual service composition", async () => {
  const patch = {},
    db = fixture(patch);
  let transactions = 0;
  db.transaction.mockImplementation(async (fn) => {
    if (++transactions === 2) patch.envelope = [];
    return fn({ query: db.query });
  });
  expect(
    await createDelegationRuntimeService(db).change(
      actor,
      "employee",
      targetId,
      input,
    ),
  ).toEqual({ kind: "denied" });
  expect(writes(db)).toHaveLength(0);
});
test("dependent removal requires exact explicit confirmation then revokes the full dependency chain", async () => {
  const db = fixture({
    grants: ["orders.read_logistics", "orders.read_details", "orders.accept"],
    envelope: ["orders.read_logistics", "orders.read_details", "orders.accept"],
  });
  const service = createDelegationRuntimeService(db),
    command = {
      expected_revision: 1,
      permission_codes: ["orders.read_details", "orders.accept"],
    };
  expect(await service.change(actor, "employee", targetId, command)).toEqual({
    kind: "confirmation_required",
    dropped_codes: ["orders.read_details", "orders.accept"],
  });
  expect(writes(db)).toHaveLength(0);
  expect(
    await service.change(actor, "employee", targetId, {
      ...command,
      confirmed_dropped_codes: ["orders.read_details", "orders.accept"],
    }),
  ).toEqual({ kind: "applied" });
  expect(writes(db).find(([s]) => s.startsWith("DELETE"))[1]).toEqual([
    targetId,
    [],
  ]);
});
test("unchanged permissions never revoke sessions or invent history; malformed commands never write", async () => {
  for (const command of [
    { expected_revision: 1, permission_codes: ["orders.read_logistics"] },
    { ...input, permission_codes: ["files.view", "files.view"] },
    { ...input, actor_id: actorId },
    { ...input, permission_codes: ["orders.accept"] },
  ]) {
    const db = fixture();
    const result = await createDelegationRuntimeService(db).change(
      actor,
      "employee",
      targetId,
      command,
    );
    expect(result.kind).toBe(
      command.permission_codes.length === 1 &&
        command.permission_codes[0] === "orders.read_logistics"
        ? "applied"
        : "invalid",
    );
    expect(writes(db)).toHaveLength(0);
  }
});
test("only current owner may configure admin delegation; envelope is not an admin usage grant", async () => {
  const db = fixture({
    actorProfile: "owner",
    owner: true,
    targetProfile: "admin",
  });
  expect(
    await createDelegationRepository(db).applyEnvelope(actor, targetId, {
      expected_revision: 1,
      permission_codes: ["files.view"],
    }),
  ).toBe("applied");
  expect(
    writes(db).some(([s]) => s.includes("INSERT INTO public.account_grants")),
  ).toBe(false);
  expect(
    writes(db).some(([s]) =>
      s.includes("INSERT INTO public.employee_delegation_limits"),
    ),
  ).toBe(true);
  const denied = fixture({ targetProfile: "admin" });
  expect(
    await createDelegationRepository(denied).applyEnvelope(actor, targetId, {
      expected_revision: 1,
      permission_codes: [],
    }),
  ).toBe("denied");
  expect(writes(denied)).toHaveLength(0);
});
test("every persistence failure escapes the transaction with no retry", async () => {
  for (const fail of [
    "DELETE FROM public.account_grants",
    "INSERT INTO public.account_grants",
    "UPDATE public.accounts",
    "UPDATE public.sessions",
    "INSERT INTO public.delegation_events",
    "INSERT INTO public.audit_events",
    "INSERT INTO public.outbox_events",
    "INSERT INTO public.outbox_dispatches",
  ]) {
    const db = fixture({ fail });
    await expect(
      createDelegationRepository(db).applyAtomic(actor, {
        targetAccountId: targetId,
        expectedRevision: 1,
        permissionCodes: input.permission_codes,
      }),
    ).rejects.toThrow("INJECTED");
    expect(db.transaction).toHaveBeenCalledTimes(1);
  }
});
test("read profile exposes editable envelope, history is target-scoped and unauthorized reads stop early", async () => {
  const db = fixture(),
    store = createDelegationRepository(db);
  expect(
    (await store.profile(actor, "employee", targetId)).editable_codes,
  ).toEqual(["orders.read_details"]);
  expect(await store.history(actor, "employee", targetId, 3)).toEqual({
    items: [],
    next_before: null,
  });
  expect(
    db.query.mock.calls.find(([s]) =>
      s.includes("FROM public.delegation_events"),
    )[1],
  ).toEqual([targetId, "employee", 3]);
  const denied = fixture({ actorGrants: [] });
  expect(
    await createDelegationRepository(denied).list(actor, "employee"),
  ).toBeNull();
  expect(
    denied.query.mock.calls.some(([s]) =>
      s.startsWith("SELECT id,email_original"),
    ),
  ).toBe(false);
});
test("web transport never retries ambiguous writes and rejects invalid paths", async () => {
  const fetcher = vi.fn(
      async () => new globalThis.Response("{}", { status: 500 }),
    ),
    client = createDelegationClient(fetcher),
    signal = new globalThis.AbortController().signal;
  await expect(
    client.change("employee", targetId, input, signal),
  ).rejects.toThrow("UNCERTAIN");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    method: "PUT",
  });
  await expect(client.profile("employee", "../bad", signal)).rejects.toThrow(
    "INVALID",
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("late transport success after abort is uncertain, never acknowledged as saved", async () => {
  const controller = new globalThis.AbortController();
  const client = createDelegationClient(async () => {
    controller.abort();
    return new globalThis.Response(JSON.stringify({ kind: "applied" }));
  });
  await expect(
    client.change("employee", targetId, input, controller.signal),
  ).rejects.toThrow("UNCERTAIN");
});
