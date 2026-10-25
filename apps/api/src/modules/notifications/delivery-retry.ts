// Dormant policy for a future delivery worker. No provider or scheduler is wired.
// Ambiguous acceptance must be reconciled externally before any retry.
export type DeliveryOutcome =
  "temporary_error" | "permanent_error" | "ambiguous";

export function nextDeliveryRetry(
  outcome: DeliveryOutcome,
  attempts: number,
  now: Date,
): { state: "pending" | "failed"; nextAttemptAt: Date | null } {
  if (
    !Number.isSafeInteger(attempts) ||
    attempts < 1 ||
    !Number.isFinite(now.getTime())
  )
    throw new Error("INVALID_DELIVERY_ATTEMPT");
  if (outcome === "permanent_error" || outcome === "ambiguous")
    return { state: "failed", nextAttemptAt: null };
  if (outcome !== "temporary_error")
    throw new Error("INVALID_DELIVERY_OUTCOME");
  // Bounded exponential technical delay; future activation requires policy review.
  const seconds = Math.min(3600, 30 * 2 ** Math.min(attempts - 1, 7));
  const nextAttemptAt = new Date(now.getTime() + seconds * 1000);
  if (!Number.isFinite(nextAttemptAt.getTime()))
    throw new Error("INVALID_DELIVERY_ATTEMPT");
  return { state: "pending", nextAttemptAt };
}
