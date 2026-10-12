import { expect, test, vi } from "vitest";
import { createClinicEmailChangeService } from "../../apps/api/dist/modules/clinics/index.js";
const clinic = {
  accountId: "fixture-account",
  profile: "clinic",
  clinicId: "fixture-clinic",
};
const admin = { accountId: "fixture-admin", profile: "admin" };
function setup() {
  let timestamp = 1000;
  let record = null;
  const ports = {
    authorizeRequest: vi.fn().mockResolvedValue(true),
    admit: vi.fn().mockReturnValue(true),
    createAtomic: vi.fn().mockResolvedValue("created"),
    authorizeDecision: vi.fn().mockResolvedValue(true),
    decideAtomic: vi.fn(async (_actor, _id, input) => {
      record = {
        id: "fixture-request",
        revision: 2,
        decision: input.decision,
        tokenDigest: input.challenge?.digest ?? null,
        expiresAt: input.challenge?.expiresAt ?? null,
        consumed: false,
        revoked: false,
      };
      return input.decision;
    }),
    admitConfirmation: vi.fn().mockReturnValue(true),
    findByDigest: vi.fn(async () => record),
    activateAtomic: vi.fn(async () => {
      record.consumed = true;
      return "activated";
    }),
  };
  return {
    ports,
    service: createClinicEmailChangeService(
      ports,
      { challengeLifetimeMs: 5000 },
      () => timestamp,
    ),
    setTime: (v) => {
      timestamp = v;
    },
    getRecord: () => record,
  };
}
const request = {
  clinicId: clinic.clinicId,
  newEmail: " Alias+tag@EXAMPLE.INVALID ",
  expectedRevision: 1,
};
test("clinic request preserves address spelling, canonical key and never activates", async () => {
  const { ports, service } = setup();
  expect(await service.request(clinic, request, "fixture-network")).toEqual({
    kind: "created",
  });
  expect(ports.createAtomic).toHaveBeenCalledWith(clinic, {
    clinicId: clinic.clinicId,
    newEmailOriginal: "Alias+tag@EXAMPLE.INVALID",
    newEmailKey: "Alias+tag@example.invalid",
    expectedRevision: 1,
  });
  expect(ports.activateAtomic).not.toHaveBeenCalled();
});
test("cross-clinic, laboratory requester, rate denied and invalid address/revision cause no request", async () => {
  const { ports, service } = setup();
  expect(
    await service.request(
      clinic,
      { ...request, clinicId: "other" },
      "fixture-network",
    ),
  ).toEqual({ kind: "denied" });
  expect(await service.request(admin, request, "fixture-network")).toEqual({
    kind: "denied",
  });
  ports.admit.mockReturnValue(false);
  expect(await service.request(clinic, request, "fixture-network")).toEqual({
    kind: "limited",
  });
  ports.admit.mockReturnValue(true);
  for (const patch of [{ newEmail: "bad" }, { expectedRevision: 0 }])
    expect(
      await service.request(
        clinic,
        { ...request, ...patch },
        "fixture-network",
      ),
    ).toEqual({ kind: "invalid" });
  expect(ports.createAtomic).not.toHaveBeenCalled();
});
test("approval requires authorized administrator and only sends protected challenge, no activation/token DTO", async () => {
  const { ports, service } = setup();
  for (const actor of [clinic, { ...admin, profile: "employee" }])
    expect(
      await service.decide(actor, "fixture-request", 1, "approved"),
    ).toEqual({ kind: "denied" });
  ports.authorizeDecision.mockResolvedValue(false);
  expect(await service.decide(admin, "fixture-request", 1, "approved")).toEqual(
    { kind: "denied" },
  );
  expect(ports.decideAtomic).not.toHaveBeenCalled();
  ports.authorizeDecision.mockResolvedValue(true);
  const result = await service.decide(admin, "fixture-request", 1, "approved");
  expect(result).toEqual({ kind: "approved" });
  const challenge = ports.decideAtomic.mock.calls[0][2].challenge;
  expect(challenge.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(challenge.digest).toHaveLength(32);
  expect(challenge.expiresAt).toBe(6000);
  expect(JSON.stringify(result)).not.toContain(challenge.token);
  expect(ports.activateAtomic).not.toHaveBeenCalled();
});
test("approved proof activates once; replay and malformed proof denied", async () => {
  const { ports, service } = setup();
  await service.decide(admin, "fixture-request", 1, "approved");
  const token = ports.decideAtomic.mock.calls[0][2].challenge.token;
  expect(await service.confirm(token, "fixture-network")).toEqual({
    kind: "activated",
  });
  expect(await service.confirm(token, "fixture-network")).toEqual({
    kind: "denied",
  });
  expect(await service.confirm(token + "=", "fixture-network")).toEqual({
    kind: "denied",
  });
  expect(ports.activateAtomic).toHaveBeenCalledTimes(1);
});
test("pending/refused/revoked/expired/wrong digest never activate; expiry exact boundary", async () => {
  for (const patch of [
    { decision: "pending" },
    { decision: "refused" },
    { revoked: true },
    { tokenDigest: Buffer.alloc(32) },
  ]) {
    const { ports, service, getRecord } = setup();
    await service.decide(admin, "fixture-request", 1, "approved");
    const token = ports.decideAtomic.mock.calls[0][2].challenge.token;
    Object.assign(getRecord(), patch);
    expect(await service.confirm(token, "fixture-network")).toEqual({
      kind: "denied",
    });
    expect(ports.activateAtomic).not.toHaveBeenCalled();
  }
  const { ports, service, setTime } = setup();
  await service.decide(admin, "fixture-request", 1, "approved");
  const token = ports.decideAtomic.mock.calls[0][2].challenge.token;
  setTime(6000);
  expect(await service.confirm(token, "fixture-network")).toEqual({
    kind: "denied",
  });
  expect(ports.activateAtomic).not.toHaveBeenCalled();
});
test("refusal creates no challenge and cannot activate; commit collision never reports activation", async () => {
  const { ports, service } = setup();
  expect(await service.decide(admin, "fixture-request", 1, "refused")).toEqual({
    kind: "refused",
  });
  expect(ports.decideAtomic.mock.calls[0][2]).not.toHaveProperty("challenge");
  await service.decide(admin, "other-request", 1, "approved");
  const token = ports.decideAtomic.mock.calls[1][2].challenge.token;
  ports.activateAtomic.mockResolvedValue("conflict");
  expect(await service.confirm(token, "fixture-network")).toEqual({
    kind: "conflict",
  });
});
test("policy and backward clock rejected without weakening expiration", async () => {
  const { ports, service, setTime } = setup();
  expect(() =>
    createClinicEmailChangeService(ports, { challengeLifetimeMs: 0 }),
  ).toThrow("INVALID_EMAIL_CHANGE_POLICY");
  await service.decide(admin, "fixture-request", 1, "approved");
  setTime(999);
  await expect(
    service.decide(admin, "fixture-request", 1, "approved"),
  ).rejects.toThrow("INVALID_EMAIL_CHANGE_CLOCK");
});

test("confirmation admission precedes lookup and expiry is checked after async lookup", async () => {
  const { ports, service, setTime } = setup();
  await service.decide(admin, "fixture-request", 1, "approved");
  const token = ports.decideAtomic.mock.calls[0][2].challenge.token;
  ports.admitConfirmation.mockReturnValue(false);
  expect(await service.confirm(token, "fixture-network")).toEqual({
    kind: "limited",
  });
  expect(ports.findByDigest).not.toHaveBeenCalled();
  ports.admitConfirmation.mockReturnValue(true);
  const lookup = ports.findByDigest.getMockImplementation();
  ports.findByDigest.mockImplementation(async (digest) => {
    const result = await lookup(digest);
    setTime(6000);
    return result;
  });
  expect(await service.confirm(token, "fixture-network")).toEqual({
    kind: "denied",
  });
  expect(ports.activateAtomic).not.toHaveBeenCalled();
});
