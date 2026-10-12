import { expect, test, vi } from "vitest";
import {
  ClinicContactUpdateSchema,
  ClinicProfileSchema,
} from "@dental-lab/contracts";
import { createClinicProfileService } from "../../apps/api/dist/modules/clinics/index.js";
const input = {
  expected_revision: 1,
  name: "Fixture Clinic",
  dentist_first_name: "Fictive",
  dentist_last_name: "Example",
  phone: "000000",
  address: "Fixture address",
};
const clinic = {
  accountId: "fixture-account",
  profile: "clinic",
  clinicId: "fixture-clinic",
};
function setup() {
  const ports = {
    authorize: vi.fn().mockResolvedValue(true),
    readAuthorized: vi.fn().mockResolvedValue({
      id: clinic.clinicId,
      revision: 1,
      ...Object.fromEntries(
        Object.entries(input).filter(([k]) => k !== "expected_revision"),
      ),
    }),
    updateAtomic: vi.fn().mockResolvedValue("applied"),
  };
  return { ports, service: createClinicProfileService(ports) };
}
test("own clinic can read and edit only contact fields with revision", async () => {
  const { ports, service } = setup();
  expect((await service.read(clinic, clinic.clinicId)).kind).toBe("found");
  expect(
    await service.update(clinic, clinic.clinicId, {
      ...input,
      name: " Fixture Clinic ",
    }),
  ).toEqual({ kind: "applied" });
  expect(ports.updateAtomic).toHaveBeenCalledWith(
    clinic,
    clinic.clinicId,
    input,
  );
});
test("cross-clinic or missing clinic identity denied before even permissive adapter", async () => {
  const { ports, service } = setup();
  for (const actor of [clinic, { ...clinic, clinicId: undefined }]) {
    expect(await service.read(actor, "other-clinic")).toEqual({
      kind: "denied",
    });
    expect(await service.update(actor, "other-clinic", input)).toEqual({
      kind: "denied",
    });
  }
  expect(ports.authorize).not.toHaveBeenCalled();
  expect(ports.updateAtomic).not.toHaveBeenCalled();
  expect(ports.readAuthorized).not.toHaveBeenCalled();
});
test("laboratory requires current clinics.manage permission", async () => {
  const { ports, service } = setup();
  const actor = { accountId: "fixture-admin", profile: "admin" };
  ports.authorize.mockResolvedValue(false);
  expect(await service.update(actor, clinic.clinicId, input)).toEqual({
    kind: "denied",
  });
  expect(ports.updateAtomic).not.toHaveBeenCalled();
  ports.authorize.mockResolvedValue(true);
  expect(await service.update(actor, clinic.clinicId, input)).toEqual({
    kind: "applied",
  });
  expect(ports.authorize).toHaveBeenLastCalledWith(
    actor,
    clinic.clinicId,
    "clinics.manage",
  );
});
test("injected email/security/state/deletion fields, blank contacts and unsafe revisions rejected", async () => {
  const { ports, service } = setup();
  for (const patch of [
    { email: "fake@example.invalid" },
    { review_state: "approved" },
    { suspended: false },
    { deleted: true },
    { clinic_id: "other" },
    { name: " " },
    { phone: 17 },
    { address: "x".repeat(2001) },
    { expected_revision: 0 },
    { expected_revision: Number.MAX_SAFE_INTEGER + 1 },
  ])
    expect(
      await service.update(clinic, clinic.clinicId, { ...input, ...patch }),
    ).toEqual({ kind: "invalid" });
  expect(ports.authorize).not.toHaveBeenCalled();
  expect(ports.updateAtomic).not.toHaveBeenCalled();
});
test("stale revision and revoked permission never become success, no automatic retry", async () => {
  for (const result of ["stale", "denied"]) {
    const { ports, service } = setup();
    ports.updateAtomic.mockResolvedValue(result);
    expect(await service.update(clinic, clinic.clinicId, input)).toEqual({
      kind: result === "stale" ? "conflict" : "denied",
    });
    expect(ports.updateAtomic).toHaveBeenCalledTimes(1);
  }
});
test("read rechecks access and fails closed on wrong clinic or private DTO fields", async () => {
  const { ports, service } = setup();
  ports.readAuthorized.mockResolvedValue(null);
  expect(await service.read(clinic, clinic.clinicId)).toEqual({
    kind: "denied",
  });
  ports.readAuthorized.mockResolvedValue({ id: "other-clinic" });
  expect(await service.read(clinic, clinic.clinicId)).toEqual({
    kind: "denied",
  });
  ports.readAuthorized.mockResolvedValue({
    id: clinic.clinicId,
    secret: "private",
  });
  await expect(service.read(clinic, clinic.clinicId)).rejects.toThrow(
    "CLINIC_PROFILE_CONTRACT_MISMATCH",
  );
  expect(ClinicContactUpdateSchema.safeParse(input).success).toBe(true);
  expect(
    ClinicProfileSchema.safeParse({
      ...input,
      id: clinic.clinicId,
      revision: 1,
    }).success,
  ).toBe(false);
});
