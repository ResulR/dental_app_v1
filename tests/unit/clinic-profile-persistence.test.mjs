import { test, expect, vi } from "vitest";
import { createClinicManagementRepository } from "../../apps/api/dist/modules/clinics/index.js";
import { createClinicProfileClient } from "../../apps/web/src/features/clinics/profile-api.ts";
const id = "70000000-0000-4000-8000-000000000001",
  clinic = "70000000-0000-4000-8000-000000000002";
const identity = { accountId: id, sessionId: id, profile: "clinic" };
const contact = {
  name: "Fixture",
  dentist_first_name: "Test",
  dentist_last_name: "Only",
  phone: "+000",
  address: "Fixture",
};
const input = { ...contact, name: "Changed", expected_revision: 1 };
function database(patch = {}) {
  const query = vi.fn(async (sql) => {
    if (sql.includes("SELECT s.id"))
      return { rows: patch.revoked ? [] : [{ id }] };
    if (sql.includes("SELECT a.profile"))
      return {
        rows: [
          {
            profile: patch.profile ?? "clinic",
            owner: false,
            managed: patch.managed ?? false,
          },
        ],
      };
    if (sql.startsWith("SELECT revision::text,account_id"))
      return {
        rows: [
          {
            ...contact,
            revision: patch.revision ?? "1",
            account_id: patch.owner ?? id,
            suspended: patch.suspended ?? false,
          },
        ],
      };
    if (patch.fail && sql.includes(patch.fail)) throw new Error("INJECTED");
    return { rows: [] };
  });
  return { query, transaction: vi.fn(async (fn) => fn({ query })) };
}
test("profile update is one transaction containing contact history, audit and event", async () => {
  const db = database();
  expect(
    await createClinicManagementRepository(db, identity).updateProfile(
      clinic,
      input,
    ),
  ).toBe("applied");
  expect(db.transaction).toHaveBeenCalledTimes(1);
  const writes = db.query.mock.calls.filter(([s]) =>
    /^(INSERT|UPDATE)/.test(s),
  );
  expect(writes).toHaveLength(5);
  expect(writes[0][0]).not.toMatch(
    /review_state|suspended|email|security_locked/,
  );
  expect(writes[1][0]).toContain("clinic_contact_events");
  expect(writes[1][1].slice(5)).toEqual([
    ...Object.values(contact),
    ...Object.values({ ...contact, name: "Changed" }),
  ]);
  expect(writes[2][1]).toContain("CLINIC_CONTACT_UPDATED");
  expect(writes[2][1]).not.toContain("Changed");
});
test("scope, suspension, revocation, permission and revision failures write nothing", async () => {
  for (const patch of [
    { owner: clinic },
    { suspended: true },
    { revoked: true },
    { revision: "2" },
    { profile: "employee", managed: false },
  ]) {
    const db = database(patch);
    const actor = { ...identity, profile: patch.profile ?? "clinic" };
    expect(
      await createClinicManagementRepository(db, actor).updateProfile(
        clinic,
        input,
      ),
    ).toBe(patch.revision ? "stale" : "denied");
    expect(db.query.mock.calls.some(([s]) => /^(INSERT|UPDATE)/.test(s))).toBe(
      false,
    );
  }
});
test("each write failure escapes the transaction and is never retried", async () => {
  for (const fail of [
    "UPDATE public.clinics",
    "INSERT INTO public.clinic_contact_events",
    "INSERT INTO public.audit_events",
    "INSERT INTO public.outbox_events",
    "INSERT INTO public.outbox_dispatches",
  ]) {
    const db = database({ fail });
    await expect(
      createClinicManagementRepository(db, identity).updateProfile(
        clinic,
        input,
      ),
    ).rejects.toThrow("INJECTED");
    expect(db.transaction).toHaveBeenCalledTimes(1);
  }
});
test("unchanged contact creates no fake version; forbidden fields never reach SQL", async () => {
  const db = database();
  const repo = createClinicManagementRepository(db, identity);
  expect(
    await repo.updateProfile(clinic, { ...contact, expected_revision: 1 }),
  ).toBe("applied");
  expect(db.query.mock.calls.some(([s]) => /^(INSERT|UPDATE)/.test(s))).toBe(
    false,
  );
  const count = db.query.mock.calls.length;
  await expect(
    repo.updateProfile(clinic, { ...input, email: "forged@example.invalid" }),
  ).rejects.toThrow();
  expect(db.query).toHaveBeenCalledTimes(count);
});
test("profile client does not retry uncertain saves and transmits only explicit input", async () => {
  const transport = vi.fn(
    async () => new globalThis.Response(null, { status: 500 }),
  );
  await expect(
    createClinicProfileClient(transport).save(
      clinic,
      input,
      new globalThis.AbortController().signal,
    ),
  ).rejects.toThrow("PROFILE_SAVE_UNCERTAIN");
  expect(transport).toHaveBeenCalledTimes(1);
  expect(transport.mock.calls[0][1]).toMatchObject({
    method: "PUT",
    cache: "no-store",
    credentials: "same-origin",
  });
});
