import { expect, test, vi } from "vitest";
import {
  createPasswordRecoveryService,
  createEmployeeInvitationService,
  createAdminInvitationService,
} from "../../apps/api/dist/modules/identity/index.js";
import {
  createClinicEmailChangeService,
  createClinicRegistrationService,
} from "../../apps/api/dist/modules/clinics/index.js";
const actor = { accountId: "fixture-owner", profile: "owner" };
const clinic = {
  accountId: "fixture-clinic",
  profile: "clinic",
  clinicId: "fixture-clinic",
};
function cases(admit) {
  const effect = vi.fn().mockRejectedValue(new Error("MUST_NOT_REACH_EFFECT"));
  const common = {
    admit,
    admitConfirmation: admit,
    hash: effect,
    findByDigest: effect,
    authorize: effect,
    authorizeOwner: effect,
    issueAtomic: effect,
    activateAtomic: effect,
  };
  const recovery = createPasswordRecoveryService(
    { ...common, enqueueAtomic: effect, resetAtomic: effect },
    { tokenLifetimeMs: 5000 },
  );
  const employee = createEmployeeInvitationService(common, {
    invitationLifetimeMs: 5000,
  });
  const admin = createAdminInvitationService(common, {
    invitationLifetimeMs: 5000,
  });
  const email = createClinicEmailChangeService(
    { ...common, authorizeRequest: effect, createAtomic: effect },
    { challengeLifetimeMs: 5000 },
  );
  return {
    effect,
    calls: [
      () => recovery.request("fixture@example.invalid", "network"),
      () => recovery.reset("invalid", "password", "network"),
      () => employee.invite(actor, "fixture@example.invalid", "network"),
      () => employee.accept("invalid", "password", "network"),
      () => admin.invite(actor, "fixture@example.invalid", "network"),
      () => admin.accept("invalid", "password", "network"),
      () =>
        email.request(
          clinic,
          {
            clinicId: clinic.clinicId,
            newEmail: "fixture@example.invalid",
            expectedRevision: 1,
          },
          "network",
        ),
      () => email.confirm("invalid", "network"),
    ],
  };
}
test("every boolean admission awaits a delayed denial before any side effect", async () => {
  let release;
  const decision = new Promise((resolve) => {
    release = resolve;
  });
  const f = cases(() => decision);
  const pending = f.calls.map((call) => call());
  await Promise.resolve();
  expect(f.effect).not.toHaveBeenCalled();
  release(false);
  expect(await Promise.all(pending)).toEqual(
    f.calls.map(() => ({ kind: "limited" })),
  );
  expect(f.effect).not.toHaveBeenCalled();
});
test("async limiter failure propagates and never falls back to admission", async () => {
  const error = new Error("LIMITER_UNAVAILABLE");
  const f = cases(async () => {
    throw error;
  });
  for (const call of f.calls) await expect(call()).rejects.toBe(error);
  expect(f.effect).not.toHaveBeenCalled();
});
test("registration waits for asynchronous admission, including malformed requests", async () => {
  const currentTermsVersion = vi.fn();
  const f = createClinicRegistrationService({
    admit: async () => ({ allowed: false, retryAfterSeconds: 4 }),
    currentTermsVersion,
    ownerInitialized: vi.fn(),
    registerAtomic: vi.fn(),
  });
  expect(await f.register({}, "network")).toEqual({
    kind: "limited",
    retryAfterSeconds: 4,
  });
  expect(currentTermsVersion).not.toHaveBeenCalled();
});
