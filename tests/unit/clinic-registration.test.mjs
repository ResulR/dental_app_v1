import { expect, test, vi } from "vitest";
import {
  createClinicRegistrationService,
  clinicCanSubmit,
} from "../../apps/api/dist/modules/clinics/index.js";

const version = "10000000-0000-4000-8000-000000000001";
const body = {
  name: " Fixture clinic ",
  dentist_first_name: " Fake ",
  dentist_last_name: " Test ",
  email: "Clinic@EXAMPLE.INVALID",
  password: "Fixture only password 2026",
  phone: "+000",
  address: "Fixture address only",
  accepted_terms: true,
  terms_version_id: version,
};
function setup(patch = {}) {
  const ports = {
    currentTermsVersion: vi.fn().mockResolvedValue(version),
    ownerInitialized: vi.fn().mockResolvedValue(true),
    admit: vi.fn().mockReturnValue({ allowed: true }),
    hash: vi.fn().mockResolvedValue("fixture-hash-port-only"),
    registerAtomic: vi.fn().mockResolvedValue("created"),
    ...patch,
  };
  return { ports, service: createClinicRegistrationService(ports) };
}
test("registration always pending clinic; raw password never sent to storage", async () => {
  const { service, ports } = setup();
  expect(await service.register(body, "trusted-network")).toEqual({
    kind: "pending",
  });
  const stored = ports.registerAtomic.mock.calls[0][0];
  expect(stored).toMatchObject({
    name: "Fixture clinic",
    profile: "clinic",
    review_state: "pending",
    email_key: "Clinic@example.invalid",
    password_hash: "fixture-hash-port-only",
    terms_version_id: version,
  });
  expect(stored).not.toHaveProperty("password");
  expect(stored).not.toHaveProperty("accepted_terms");
});
test("mandatory fields and privilege escalation rejected before hash/storage", async () => {
  for (const patch of [
    { name: "" },
    { dentist_first_name: " " },
    { dentist_last_name: "" },
    { phone: "" },
    { address: "" },
    { email: "bad" },
    { password: "short" },
    { accepted_terms: false },
    { terms_version_id: "bad" },
    { profile: "owner" },
    { review_state: "approved" },
  ]) {
    const { service, ports } = setup();
    expect(
      (await service.register({ ...body, ...patch }, "trusted-network")).kind,
    ).toBe("invalid");
    expect(ports.hash).not.toHaveBeenCalled();
    expect(ports.registerAtomic).not.toHaveBeenCalled();
  }
});
test("missing current terms or initial owner fails closed without invented approval", async () => {
  for (const patch of [
    { currentTermsVersion: async () => undefined },
    { ownerInitialized: async () => false },
  ]) {
    const { service, ports } = setup(patch);
    expect(await service.register(body, "trusted-network")).toEqual({
      kind: "unavailable",
    });
    expect(ports.hash).not.toHaveBeenCalled();
    expect(ports.registerAtomic).not.toHaveBeenCalled();
  }
});
test("obsolete terms refused; race at commit requests fresh consent", async () => {
  const f = setup();
  expect(
    await f.service.register(
      { ...body, terms_version_id: "10000000-0000-4000-8000-000000000002" },
      "trusted-network",
    ),
  ).toEqual({ kind: "invalid", fields: ["/terms_version_id"] });
  expect(f.ports.registerAtomic).not.toHaveBeenCalled();
  const g = setup({ registerAtomic: async () => "terms_changed" });
  expect(await g.service.register(body, "trusted-network")).toEqual({
    kind: "invalid",
    fields: ["/terms_version_id"],
  });
});
test("rate limit admission prevents hashing/storage", async () => {
  const f = setup({ admit: () => ({ allowed: false, retryAfterSeconds: 2 }) });
  expect(await f.service.register(body, "trusted-network")).toEqual({
    kind: "limited",
    retryAfterSeconds: 2,
  });
  expect(f.ports.hash).not.toHaveBeenCalled();
  expect(f.ports.registerAtomic).not.toHaveBeenCalled();
});
test("storage failure never reported as registration success", async () => {
  const error = new Error("fixture transaction failed");
  const f = setup({
    registerAtomic: async () => {
      throw error;
    },
  });
  await expect(f.service.register(body, "trusted-network")).rejects.toBe(error);
  const g = setup({ registerAtomic: async () => "duplicate" });
  expect(await g.service.register(body, "trusted-network")).toEqual({
    kind: "conflict",
  });
});
test("non-approved, suspended, compromised or wrong-profile clinic cannot submit", () => {
  const current = {
    profile: "clinic",
    lifecycle: "active",
    reviewState: "approved",
    suspended: false,
    securityLocked: false,
    credentialResetRequired: false,
  };
  expect(clinicCanSubmit(current)).toBe(true);
  for (const patch of [
    { reviewState: "pending" },
    { reviewState: "refused" },
    { suspended: true },
    { securityLocked: true },
    { credentialResetRequired: true },
    { lifecycle: "suspended" },
    { profile: "employee" },
  ])
    expect(clinicCanSubmit({ ...current, ...patch })).toBe(false);
});
