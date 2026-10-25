// Pure dormant protocol. No credentials, address, transport or scheduler.
import { createHmac } from "node:crypto";

export type ProviderEvidence =
  | { kind: "verified_acceptance"; idempotencyKey: string; providerId: string }
  | { kind: "verified_rejection"; idempotencyKey: string }
  | { kind: "not_found"; idempotencyKey: string }
  | { kind: "unavailable" };

export function providerAttemptKey(
  secret: Uint8Array,
  deliveryId: string,
  attemptNumber: number,
): string {
  if (
    !(secret instanceof Uint8Array) ||
    secret.byteLength < 32 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      deliveryId,
    ) ||
    !Number.isSafeInteger(attemptNumber) ||
    attemptNumber < 1
  )
    throw new Error("PROVIDER_ATTEMPT_KEY_INVALID");
  return createHmac("sha256", secret)
    .update("dental-lab/email-attempt/v1\0")
    .update(deliveryId.toLowerCase())
    .update("\0")
    .update(String(attemptNumber))
    .digest("hex");
}

export function reconcileAmbiguous(
  expectedKey: string,
  evidence: ProviderEvidence,
): { decision: "accepted" | "manual_review"; providerId?: string } {
  if (!/^[0-9a-f]{64}$/.test(expectedKey))
    throw new Error("PROVIDER_EVIDENCE_INVALID");
  if (evidence.kind === "verified_acceptance") {
    if (
      evidence.idempotencyKey !== expectedKey ||
      !/^[A-Za-z0-9._:-]{1,128}$/.test(evidence.providerId)
    )
      throw new Error("PROVIDER_EVIDENCE_INVALID");
    return { decision: "accepted", providerId: evidence.providerId };
  }
  if (evidence.kind === "verified_rejection" || evidence.kind === "not_found") {
    if (evidence.idempotencyKey !== expectedKey)
      throw new Error("PROVIDER_EVIDENCE_INVALID");
  } else if (evidence.kind !== "unavailable")
    throw new Error("PROVIDER_EVIDENCE_INVALID");
  // Even "not found" can race with eventual provider acceptance.
  return { decision: "manual_review" };
}
