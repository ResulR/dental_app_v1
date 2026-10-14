import { test, expect, vi } from "vitest";
import { createClinicManagementRepository } from "../../apps/api/dist/modules/clinics/index.js";
import { clinicManagementEnabled } from "../../apps/api/dist/app/clinic-management-config.js";
const id = "70000000-0000-4000-8000-000000000001";
const clinic = "70000000-0000-4000-8000-000000000002";
const identity = { accountId: id, sessionId: id, profile: "admin" };
function database(patch = {}) {
  const query = vi.fn(async (sql) => {
    if (sql.includes("SELECT s.id"))
      return { rows: patch.revoked ? [] : [{ id }] };
    if (sql.includes("SELECT a.profile"))
      return {
        rows: [
          {
            profile: patch.profile ?? "admin",
            owner: false,
            managed: patch.managed ?? true,
          },
        ],
      };
    if (sql.includes("SELECT revision::text"))
      return {
        rows: [
          {
            revision: patch.revision ?? "1",
            review_state: patch.state ?? "pending",
          },
        ],
      };
    if (sql.includes("SELECT id,revision::text"))
      return {
        rows: [
          {
            id: clinic,
            revision: "1",
            name: "Fixture",
            dentist_first_name: "Test",
            dentist_last_name: "Only",
            phone: "+000",
            address: "Fixture",
            suspended: patch.suspended ?? false,
            account_id: patch.account ?? id,
          },
        ],
      };
    if (patch.fail && sql.includes(patch.fail)) throw new Error("INJECTED");
    return { rows: [] };
  });
  const transaction = vi.fn(async (fn) => fn({ query }));
  return { query, transaction };
}
const decision = {
  clinicId: clinic,
  actorAccountId: id,
  expectedRevision: 1,
  decision: "approved",
};
test("management flag remains off and requires authentication", () => {
  expect(clinicManagementEnabled({})).toBe(false);
  expect(() =>
    clinicManagementEnabled({ DENTAL_LAB_CLINIC_MANAGEMENT_ENABLED: "true" }),
  ).toThrow();
  expect(
    clinicManagementEnabled({
      DENTAL_LAB_CLINIC_MANAGEMENT_ENABLED: "true",
      DENTAL_LAB_AUTH_ENABLED: "true",
    }),
  ).toBe(true);
});
test("review writes decision, audit and outbox in one transaction without touching suspension", async () => {
  const db = database();
  expect(
    await createClinicManagementRepository(db, identity).decideAtomic(decision),
  ).toBe("applied");
  expect(db.transaction).toHaveBeenCalledTimes(1);
  const sql = db.query.mock.calls.map((x) => x[0]);
  expect(sql.filter((x) => x.startsWith("INSERT"))).toHaveLength(4);
  expect(sql.find((x) => x.startsWith("UPDATE"))).toBe(
    "UPDATE public.clinics SET review_state=$2,revision=revision+1 WHERE id=$1",
  );
  expect(sql).toContain("LOCK TABLE public.account_grants IN SHARE MODE");
  expect(sql.some((x) => x.includes("FOR SHARE OF s"))).toBe(true);
});
test("revoked sessions, permissions, stale revision and prior decision do not write", async () => {
  for (const [patch, result] of [
    [{ revoked: true }, "denied"],
    [{ managed: false }, "denied"],
    [{ revision: "2" }, "stale"],
    [{ state: "refused" }, "not_pending"],
  ]) {
    const db = database(patch);
    expect(
      await createClinicManagementRepository(db, identity).decideAtomic(
        decision,
      ),
    ).toBe(result);
    expect(
      db.query.mock.calls.some(([sql]) => /^(UPDATE|INSERT)/.test(sql)),
    ).toBe(false);
  }
});
test("each persistence failure escapes transaction without retry or success", async () => {
  for (const fail of [
    "UPDATE public.clinics",
    "INSERT INTO public.clinic_review_events",
    "INSERT INTO public.audit_events",
    "INSERT INTO public.outbox_events",
    "INSERT INTO public.outbox_dispatches",
  ]) {
    const db = database({ fail });
    await expect(
      createClinicManagementRepository(db, identity).decideAtomic(decision),
    ).rejects.toThrow("INJECTED");
    expect(db.transaction).toHaveBeenCalledTimes(1);
  }
});
test("profile data is scoped and suspension blocks clinic reads", async () => {
  for (const patch of [
    { profile: "clinic", account: clinic },
    { profile: "clinic", suspended: true },
  ]) {
    const db = database(patch);
    expect(
      await createClinicManagementRepository(db, {
        ...identity,
        profile: "clinic",
      }).readProfile(clinic),
    ).toBeNull();
  }
  const db = database({ profile: "clinic" });
  expect(
    await createClinicManagementRepository(db, {
      ...identity,
      profile: "clinic",
    }).readProfile(),
  ).toMatchObject({ id: clinic, revision: 1 });
});

import { registrationEmail } from "../../apps/api/dist/modules/notifications/index.js";
test("registration email remains private and rejects external URL parts", () => {
  expect(registrationEmail("https://dental.example.test")).toEqual({
    subject: "Kërkesë e re për regjistrimin e një klinike",
    text: expect.stringContaining("https://dental.example.test/"),
  });
  for (const origin of [
    "http://dental.example.test",
    "https://user:password@dental.example.test",
    "https://dental.example.test/redirect?to=evil",
  ])
    expect(() => registrationEmail(origin)).toThrow();
});

import { createClinicProfileClient } from "../../apps/web/src/features/clinics/profile-api.ts";
test("profile transport uses own server scope, no cache/storage and rejects invalid data", async () => {
  const transport = vi.fn(
    async () =>
      new globalThis.Response(JSON.stringify({ id: "invalid" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  const signal = new globalThis.AbortController().signal;
  expect(await createClinicProfileClient(transport).own(signal)).toBeNull();
  expect(transport).toHaveBeenCalledWith(
    "/api/v1/clinics/self/profile",
    expect.objectContaining({
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal,
    }),
  );
});

import { assertClinicManagementStorageReady } from "../../apps/api/dist/modules/clinics/index.js";
test("management startup rejects missing or insufficient privileges", async () => {
  for (const rows of [[], [{ ready: false }]])
    await expect(
      assertClinicManagementStorageReady({ query: async () => ({ rows }) }),
    ).rejects.toThrow("CLINIC_MANAGEMENT_STORAGE_NOT_READY");
  await assertClinicManagementStorageReady({
    query: async () => ({ rows: [{ ready: true }] }),
  });
});

import { createClinicReviewClient } from "../../apps/web/src/features/clinics/review-api.ts";
test("review client sends expected revision once and surfaces conflicts without retry", async () => {
  const transport = vi.fn(
    async () => new globalThis.Response(null, { status: 409 }),
  );
  expect(
    await createClinicReviewClient(transport).decide(
      clinic,
      { expected_revision: 1, decision: "approved" },
      new globalThis.AbortController().signal,
    ),
  ).toBe("conflict");
  expect(transport).toHaveBeenCalledTimes(1);
  expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual({
    expected_revision: 1,
    decision: "approved",
  });
});
test("pending list requires current management permission before reading clinics", async () => {
  const db = database({ managed: false });
  expect(
    await createClinicManagementRepository(db, identity).pending(),
  ).toBeNull();
  expect(db.query.mock.calls.some(([sql]) => sql.includes("LIMIT 51"))).toBe(
    false,
  );
});
