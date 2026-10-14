import { expect, test, vi } from "vitest";
import { createHash } from "node:crypto";
import { registrationEnabled } from "../../apps/api/dist/app/registration-config.js";
import {
  createRegistrationTermsRepository,
  assertRegistrationStorageReady,
} from "../../apps/api/dist/modules/clinics/index.js";
import { createRegistrationNotificationRepository } from "../../apps/api/dist/modules/notifications/index.js";
import { createRegistrationClient } from "../../apps/web/src/features/clinics/registration-api.ts";
test("registration disabled by default and cannot bypass authentication config", () => {
  expect(registrationEnabled({})).toBe(false);
  expect(
    registrationEnabled({ DENTAL_LAB_REGISTRATION_ENABLED: "false" }),
  ).toBe(false);
  for (const value of ["yes", "1", "true"])
    expect(() =>
      registrationEnabled({ DENTAL_LAB_REGISTRATION_ENABLED: value }),
    ).toThrow();
  expect(
    registrationEnabled({
      DENTAL_LAB_REGISTRATION_ENABLED: "true",
      DENTAL_LAB_AUTH_ENABLED: "true",
    }),
  ).toBe(true);
});
test("terms require exact hash, approval metadata and bounded valid payload", async () => {
  const body = "Synthetic text, not legal advice.";
  const row = {
    version_id: "10000000-0000-4000-8000-000000000001",
    body,
    body_sha256: createHash("sha256").update(body).digest(),
    approved: true,
  };
  for (const patch of [
    { approved: false },
    { body: "changed" },
    { body_sha256: Buffer.alloc(32) },
  ]) {
    const store = createRegistrationTermsRepository({
      query: async () => ({ rows: [{ ...row, ...patch }] }),
    });
    expect(await store.current()).toBeUndefined();
  }
  const store = createRegistrationTermsRepository({
    query: async () => ({ rows: [row] }),
  });
  expect(await store.current()).toEqual({
    version_id: row.version_id,
    body,
    body_sha256: row.body_sha256.toString("hex"),
  });
});
test("registration readiness rejects false/missing results and propagates SQL error", async () => {
  for (const rows of [[], [{ ready: false }], [{ ready: null }]])
    await expect(
      assertRegistrationStorageReady({ query: async () => ({ rows }) }),
    ).rejects.toThrow("REGISTRATION_STORAGE_NOT_READY");
  await assertRegistrationStorageReady({
    query: async () => ({ rows: [{ ready: true }] }),
  });
});
test("email preparation locks dispatch and never sends or resolves personal addresses", async () => {
  const query = vi.fn(async (sql) => ({
    rows: sql.includes("FOR UPDATE")
      ? [{ state: "pending" }]
      : sql.includes("SELECT a.id")
        ? [{ id: "owner-fixture" }]
        : [],
  }));
  const transaction = vi.fn(async (work) => work({ query }));
  expect(
    await createRegistrationNotificationRepository({ transaction }).prepare(
      "fixture",
    ),
  ).toBe("prepared");
  expect(query.mock.calls).toHaveLength(3);
  expect(query.mock.calls[0][0]).toContain("FOR UPDATE OF d");
  expect(query.mock.calls[2][0]).toContain("clinics.manage");
  expect(query.mock.calls[2][0]).toContain("ON CONFLICT");
  expect(query.mock.calls[2][0]).not.toContain("email_original");
  const fail = new Error("FAIL");
  await expect(
    createRegistrationNotificationRepository({
      transaction: async () => {
        throw fail;
      },
    }).prepare("fixture"),
  ).rejects.toBe(fail);
});
test("already dispatched events are not planned twice", async () => {
  const query = vi.fn(async () => ({ rows: [{ state: "dispatched" }] }));
  const store = createRegistrationNotificationRepository({
    transaction: async (work) => work({ query }),
  });
  expect(await store.prepare("fixture")).toBe("skipped");
  expect(query).toHaveBeenCalledTimes(1);
});
test("registration client does not retry ambiguous submissions or persist credentials", async () => {
  const transport = vi.fn().mockRejectedValue(new Error("connection lost"));
  const api = createRegistrationClient(transport);
  const data = {
    name: "Fixture",
    dentist_first_name: "Test",
    dentist_last_name: "Only",
    phone: "+000",
    address: "Fixture",
    email: "fixture@example.invalid",
    password: "Synthetic password only",
    accepted_terms: true,
    terms_version_id: "10000000-0000-4000-8000-000000000001",
  };
  expect(await api.register(data)).toBe("uncertain");
  expect(transport).toHaveBeenCalledTimes(1);
  expect(transport.mock.calls[0][1]).toMatchObject({
    cache: "no-store",
    redirect: "error",
    credentials: "same-origin",
  });
  expect(await api.terms()).toBeUndefined();
});
