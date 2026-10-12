import { expect, test, vi } from "vitest";
import { createClinicReviewService } from "../../apps/api/dist/modules/clinics/index.js";
const actor = { accountId: "fixture-admin", profile: "admin" };
const input = {
  clinicId: "fixture-clinic",
  expectedRevision: 1,
  decision: "approved",
};
test("current permission and expected revision required before atomic decision", async () => {
  const authorize = vi.fn().mockResolvedValue(true);
  const decideAtomic = vi.fn().mockResolvedValue("applied");
  const service = createClinicReviewService({ authorize, decideAtomic });
  expect(await service.decide(actor, input)).toEqual({ kind: "applied" });
  expect(authorize).toHaveBeenCalledWith(
    actor,
    input.clinicId,
    "clinics.manage",
  );
  expect(decideAtomic).toHaveBeenCalledWith({
    ...input,
    actorAccountId: actor.accountId,
  });
});
test("clinic cannot approve itself; lab grant denied causes no mutation", async () => {
  const authorize = vi.fn().mockResolvedValue(false);
  const decideAtomic = vi.fn();
  const service = createClinicReviewService({ authorize, decideAtomic });
  expect(
    await service.decide(
      { accountId: "fixture-account", profile: "clinic" },
      input,
    ),
  ).toEqual({ kind: "denied" });
  expect(authorize).not.toHaveBeenCalled();
  expect(await service.decide(actor, input)).toEqual({ kind: "denied" });
  expect(decideAtomic).not.toHaveBeenCalled();
});
test("stale state/revision or permission revoked at commit cannot report success", async () => {
  for (const result of ["stale", "not_pending", "denied"]) {
    const service = createClinicReviewService({
      authorize: async () => true,
      decideAtomic: async () => result,
    });
    expect(await service.decide(actor, input)).toEqual({
      kind: result === "denied" ? "denied" : "conflict",
    });
  }
});
test("refusal reason retained without inventing mandatory clinic reason", async () => {
  const decideAtomic = vi.fn().mockResolvedValue("applied");
  const service = createClinicReviewService({
    authorize: async () => true,
    decideAtomic,
  });
  expect(
    await service.decide(actor, {
      ...input,
      decision: "refused",
      reason: " Fixture reason ",
    }),
  ).toEqual({ kind: "applied" });
  expect(decideAtomic.mock.calls[0][0]).toMatchObject({
    decision: "refused",
    reason: "Fixture reason",
  });
  expect(
    await service.decide(actor, { ...input, decision: "refused" }),
  ).toEqual({ kind: "applied" });
});
test("invalid decisions/revisions rejected before authorization or persistence", async () => {
  const authorize = vi.fn();
  const decideAtomic = vi.fn();
  const service = createClinicReviewService({ authorize, decideAtomic });
  for (const patch of [
    { expectedRevision: 0 },
    { decision: "active" },
    { reason: 10 },
  ])
    expect(await service.decide(actor, { ...input, ...patch })).toEqual({
      kind: "invalid",
    });
  expect(authorize).not.toHaveBeenCalled();
  expect(decideAtomic).not.toHaveBeenCalled();
});
