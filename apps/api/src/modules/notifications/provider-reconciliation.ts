// Pure dormant protocol. No credentials, address, transport or scheduler.
import { createHmac, timingSafeEqual } from "node:crypto";

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

// The key version must be persisted with the original attempt. Rotation must never
// recalculate an uncertain attempt with the new active secret.
export type VersionedAttemptKey = Readonly<{
  keyVersion: string;
  idempotencyKey: string;
}>;

export function versionedProviderAttemptKey(
  keyVersion: string,
  secret: Uint8Array,
  deliveryId: string,
  attemptNumber: number,
): VersionedAttemptKey {
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(keyVersion))
    throw new Error("PROVIDER_KEY_VERSION_INVALID");
  // Validate all inputs through the legacy derivation, then bind the version
  // into a distinct domain so a reused secret cannot silently alias a version.
  providerAttemptKey(secret, deliveryId, attemptNumber);
  return {
    keyVersion,
    idempotencyKey: createHmac("sha256", secret)
      .update("dental-lab/email-attempt/versioned/v1\0")
      .update(keyVersion)
      .update("\0")
      .update(deliveryId.toLowerCase())
      .update("\0")
      .update(String(attemptNumber))
      .digest("hex"),
  };
}

export function verifyRecordedAttemptKey(
  recorded: VersionedAttemptKey,
  resolveSecret: (version: string) => Uint8Array | undefined,
  deliveryId: string,
  attemptNumber: number,
): boolean {
  if (
    !recorded ||
    typeof recorded.keyVersion !== "string" ||
    !/^[A-Za-z0-9._-]{1,32}$/.test(recorded.keyVersion) ||
    typeof recorded.idempotencyKey !== "string" ||
    !/^[0-9a-f]{64}$/.test(recorded.idempotencyKey)
  )
    throw new Error("PROVIDER_RECORDED_KEY_INVALID");
  const secret = resolveSecret(recorded.keyVersion);
  if (!secret) return false; // Unavailable historical key requires manual review.
  const expected = versionedProviderAttemptKey(
    recorded.keyVersion,
    secret,
    deliveryId,
    attemptNumber,
  ).idempotencyKey;
  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(recorded.idempotencyKey, "hex"),
  );
}

export function reconcileAmbiguous(
  expectedKey: string,
  evidence: ProviderEvidence,
  // Supplied only by a trusted adapter after authenticating provider provenance.
  // A raw `verified_acceptance` object is never sufficient by itself.
  verifyAcceptance?: (
    evidence: Extract<ProviderEvidence, { kind: "verified_acceptance" }>,
  ) => boolean,
): { decision: "accepted" | "manual_review"; providerId?: string } {
  if (!/^[0-9a-f]{64}$/.test(expectedKey))
    throw new Error("PROVIDER_EVIDENCE_INVALID");
  if (evidence.kind === "verified_acceptance") {
    if (
      evidence.idempotencyKey !== expectedKey ||
      !/^[A-Za-z0-9._:-]{1,128}$/.test(evidence.providerId)
    )
      throw new Error("PROVIDER_EVIDENCE_INVALID");
    if (!verifyAcceptance || verifyAcceptance(evidence) !== true)
      return { decision: "manual_review" };
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
