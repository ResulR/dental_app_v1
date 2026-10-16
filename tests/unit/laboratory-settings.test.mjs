import { test, expect, vi } from "vitest";
import {
  createLaboratorySettingsService,
  assertLaboratorySettingsReady,
} from "../../apps/api/dist/modules/settings/index.js";
import { laboratorySettingsEnabled } from "../../apps/api/dist/app/laboratory-settings-config.js";
import { LaboratoryUpdateSchema } from "../../packages/contracts/dist/index.js";
import { createLaboratorySettingsClient } from "../../apps/web/src/features/settings/settings-api.ts";
const id = "86000000-0000-4000-8000-000000000001",
  actor = { accountId: id, sessionId: id };
const fields = {
  name: "Synthetic Lab",
  address: "Synthetic address",
  phone: "+00000000",
  email: "lab@example.test",
  opening_hours: "Orari sintetik",
  map_url: "https://maps.example.test/location?q=synthetic",
};
function fixture(patch = {}) {
  const query = vi.fn(async (sql) => {
    if (patch.fail && sql.startsWith(patch.fail)) throw new Error("INJECTED");
    if (sql.startsWith("SELECT a.profile"))
      return {
        rows: patch.revoked
          ? []
          : [
              {
                profile: patch.profile ?? "admin",
                lifecycle: patch.lifecycle ?? "active",
                securityLocked: false,
                resetRequired: false,
                sessionValid: true,
                ownerCurrent: true,
                clinicId: id,
                clinicSuspended: patch.suspended ?? false,
                grants: patch.grants ?? ["settings.manage"],
              },
            ],
      };
    if (sql.startsWith("SELECT revision::text,fields"))
      return {
        rows: [
          { revision: patch.revision ?? "0", fields: patch.fields ?? null },
        ],
      };
    if (sql.startsWith("UPDATE public.laboratory_public_settings"))
      return { rows: patch.writeMissing ? [] : [{ id }] };
    if (sql.includes("FROM public.laboratory_settings_events"))
      return { rows: patch.history ?? [] };
    return { rows: [] };
  });
  return { query, transaction: vi.fn(async (fn) => fn({ query })) };
}
const writes = (db) =>
  db.query.mock.calls.filter(([s]) => /^(UPDATE|INSERT|DELETE)/.test(s));
test("active clinic and laboratory accounts can read unconfigured or configured public fields only", async () => {
  for (const profile of ["clinic", "employee", "admin", "owner"]) {
    const db = fixture({ profile, grants: [] }),
      store = createLaboratorySettingsService(db);
    expect(await store.read(actor)).toEqual({ revision: 0, fields: null });
    expect(writes(db)).toHaveLength(0);
  }
  expect(
    await createLaboratorySettingsService(
      fixture({ fields, revision: "2" }),
    ).read(actor),
  ).toEqual({ revision: 2, fields });
});
test("inactive revoked suspended clinical and locked contexts fail before reading settings", async () => {
  for (const patch of [
    { revoked: true },
    { lifecycle: "invited" },
    { lifecycle: "suspended" },
    { profile: "clinic", suspended: true },
  ]) {
    const db = fixture(patch),
      store = createLaboratorySettingsService(db);
    expect(await store.read(actor)).toBeNull();
    expect(await store.update(actor, { expected_revision: 0, fields })).toEqual(
      { kind: "denied" },
    );
    expect(
      db.query.mock.calls.some(([s]) => s.startsWith("SELECT revision::text")),
    ).toBe(false);
  }
});
test("management permission is current, separate from public read and clinical profile never manages", async () => {
  for (const patch of [
    { grants: [] },
    { grants: ["catalog.manage"] },
    { profile: "clinic" },
  ]) {
    const db = fixture(patch),
      store = createLaboratorySettingsService(db);
    expect(await store.update(actor, { expected_revision: 0, fields })).toEqual(
      { kind: "denied" },
    );
    expect(await store.history(actor)).toBeNull();
    expect(writes(db)).toHaveLength(0);
  }
  const patch = {},
    db = fixture(patch),
    store = createLaboratorySettingsService(db);
  await store.read(actor);
  patch.revoked = true;
  expect(await store.update(actor, { expected_revision: 0, fields })).toEqual({
    kind: "denied",
  });
});
test("owner or settings delegate writes CAS history audit and outbox in one transaction without touching orders or contacts", async () => {
  for (const profile of ["owner", "admin", "employee"]) {
    const db = fixture({ profile }),
      store = createLaboratorySettingsService(db);
    expect(await store.update(actor, { expected_revision: 0, fields })).toEqual(
      { kind: "applied" },
    );
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(writes(db)).toHaveLength(5);
    expect(
      db.query.mock.calls.find(([s]) =>
        s.startsWith("SELECT revision::text"),
      )[0],
    ).toContain("FOR UPDATE");
    expect(writes(db)[0][1]).toEqual([id, JSON.stringify(fields), id, 0]);
    expect(writes(db)[1][1][4]).toBeNull();
    expect(JSON.parse(writes(db)[1][1][5])).toEqual(fields);
    expect(
      writes(db)
        .map(([s]) => s)
        .join(" "),
    ).not.toMatch(/public\.(orders|clinics|accounts|notification_deliveries)/);
  }
});
test("stale revision refuses writes, unchanged fields are idempotent and null removes a public field", async () => {
  const db = fixture({ fields, revision: "2" }),
    store = createLaboratorySettingsService(db);
  expect(await store.update(actor, { expected_revision: 1, fields })).toEqual({
    kind: "conflict",
  });
  expect(await store.update(actor, { expected_revision: 2, fields })).toEqual({
    kind: "applied",
  });
  expect(writes(db)).toHaveLength(0);
  expect(
    await store.update(actor, {
      expected_revision: 2,
      fields: { ...fields, phone: null },
    }),
  ).toEqual({ kind: "applied" });
  expect(JSON.parse(writes(db)[1][1][4]).phone).toBe(fields.phone);
  expect(JSON.parse(writes(db)[1][1][5]).phone).toBeNull();
});
test("strict schema rejects financial fields, secrets, invalid links, missing fields and overlong text", async () => {
  const db = fixture(),
    store = createLaboratorySettingsService(db);
  for (const raw of [
    { expected_revision: 0, fields: { ...fields, price: 3 } },
    { expected_revision: 0, fields, secret: "not-allowed" },
    { expected_revision: -1, fields },
    ...[
      "javascript:alert(1)",
      "http://example.test",
      "https://user:password@example.test",
    ].map((map_url) => ({
      expected_revision: 0,
      fields: { ...fields, map_url },
    })),
    { expected_revision: 0, fields: { ...fields, name: "x".repeat(201) } },
    { expected_revision: 0, fields: { name: "Only" } },
  ]) {
    expect(LaboratoryUpdateSchema.safeParse(raw).success).toBe(false);
    expect(await store.update(actor, raw)).toEqual({ kind: "invalid" });
  }
  expect(db.transaction).not.toHaveBeenCalled();
});
test("every persistence failure propagates without retry or success; actual SQL rollback remains unreceived", async () => {
  for (const fail of [
    "UPDATE public.laboratory_public_settings",
    "INSERT INTO public.laboratory_settings_events",
    "INSERT INTO public.audit_events",
    "INSERT INTO public.outbox_events",
    "INSERT INTO public.outbox_dispatches",
  ]) {
    const db = fixture({ fail });
    await expect(
      createLaboratorySettingsService(db).update(actor, {
        expected_revision: 0,
        fields,
      }),
    ).rejects.toThrow("INJECTED");
    expect(db.transaction).toHaveBeenCalledTimes(1);
  }
  await expect(
    createLaboratorySettingsService(fixture({ writeMissing: true })).update(
      actor,
      { expected_revision: 0, fields },
    ),
  ).rejects.toThrow("SETTINGS_WRITE_FAILED");
});
test("history is bounded and scoped to the single public settings aggregate", async () => {
  const db = fixture({
    history: [
      {
        id,
        actor_id: id,
        revision: "1",
        occurred_at: new Date("2026-10-01T00:00:00Z"),
        previous: null,
        next: fields,
      },
    ],
  });
  const result = await createLaboratorySettingsService(db).history(actor, 4);
  expect(result.items[0].revision).toBe(1);
  expect(result.next_before).toBeNull();
  expect(
    db.query.mock.calls.find(([s]) =>
      s.includes("FROM public.laboratory_settings_events"),
    )[1],
  ).toEqual([id, 4]);
});
test("client never retries ambiguous mutation, rejects malformed read and uses no-store same-origin", async () => {
  const controller = new globalThis.AbortController(),
    transport = vi.fn(async () => {
      controller.abort();
      return new globalThis.Response(JSON.stringify({ kind: "applied" }));
    });
  await expect(
    createLaboratorySettingsClient(transport).update(
      { expected_revision: 0, fields },
      controller.signal,
    ),
  ).rejects.toThrow("UNCERTAIN");
  expect(transport).toHaveBeenCalledTimes(1);
  expect(transport.mock.calls[0][1]).toMatchObject({
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    method: "PUT",
  });
  const bad = createLaboratorySettingsClient(
    async () =>
      new globalThis.Response(
        JSON.stringify({ revision: 0, fields: { price: 3 } }),
      ),
  );
  await expect(
    bad.read(new globalThis.AbortController().signal),
  ).rejects.toThrow();
});
test("feature defaults off, requires authentication and readiness refuses mutable history", async () => {
  expect(laboratorySettingsEnabled({})).toBe(false);
  expect(
    laboratorySettingsEnabled({
      DENTAL_LAB_LABORATORY_SETTINGS_ENABLED: "true",
      DENTAL_LAB_AUTH_ENABLED: "true",
    }),
  ).toBe(true);
  expect(() =>
    laboratorySettingsEnabled({
      DENTAL_LAB_LABORATORY_SETTINGS_ENABLED: "true",
    }),
  ).toThrow();
  const query = vi.fn(async () => ({ rows: [{ ready: false }] }));
  await expect(assertLaboratorySettingsReady({ query })).rejects.toThrow(
    "NOT_READY",
  );
  expect(query.mock.calls[0][0]).toContain("NOT has_table_privilege");
});
