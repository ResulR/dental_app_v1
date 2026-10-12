type Actor = {
  accountId: string;
  profile: "owner" | "admin" | "employee" | "clinic";
};
export type ClinicDecision = {
  clinicId: string;
  expectedRevision: number;
  decision: "approved" | "refused";
  reason?: string;
};
type Ports = {
  authorize: (
    actor: Actor,
    clinicId: string,
    action: "clinics.manage",
  ) => Promise<boolean>;
  // Must recheck grant, current pending state and revision inside the transaction;
  // update only review_state/revision, append decision/audit and intended event.
  // Do not clear suspension/security flags or add an unrequested email category.
  decideAtomic: (
    input: ClinicDecision & { actorAccountId: string },
  ) => Promise<"applied" | "stale" | "not_pending" | "denied">;
};
export function createClinicReviewService(ports: Ports) {
  return {
    async decide(
      actor: Actor,
      input: ClinicDecision,
    ): Promise<{ kind: "applied" | "conflict" | "denied" | "invalid" }> {
      if (actor.profile === "clinic") return { kind: "denied" };
      if (
        !input.clinicId ||
        !Number.isSafeInteger(input.expectedRevision) ||
        input.expectedRevision < 1 ||
        !["approved", "refused"].includes(input.decision) ||
        (input.reason !== undefined && typeof input.reason !== "string")
      )
        return { kind: "invalid" };
      if (!(await ports.authorize(actor, input.clinicId, "clinics.manage")))
        return { kind: "denied" };
      const reason = input.reason?.trim();
      const result = await ports.decideAtomic({
        clinicId: input.clinicId,
        expectedRevision: input.expectedRevision,
        decision: input.decision,
        actorAccountId: actor.accountId,
        ...(reason ? { reason } : {}),
      });
      return {
        kind:
          result === "applied"
            ? "applied"
            : result === "denied"
              ? "denied"
              : "conflict",
      };
    },
  };
}
