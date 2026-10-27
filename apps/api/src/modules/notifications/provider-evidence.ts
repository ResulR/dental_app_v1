// Dormant reconciliation boundary. The authenticator is a trusted adapter,
// not a caller-supplied property of the provider response. No transport or SQL.
import { createHash, timingSafeEqual } from "node:crypto";
import { verifyRecordedAttemptKey } from "./provider-reconciliation.js";

export type RecordedProviderAttempt = Readonly<{
  deliveryId: string;
  attemptNumber: number;
  keyVersion: string;
  idempotencyKey: string;
  provider: string;
  providerAccount: string;
}>;

// These claims must be extracted from an authenticated provider channel or
// bound to a trusted status-query context by the future provider adapter.
export type AuthenticatedObservation = Readonly<{
  claims: Readonly<{
    provider: string;
    providerAccount: string;
    keyVersion: string;
    idempotencyKey: string;
    status: "accepted" | "rejected" | "ambiguous" | "not_found";
    providerMessageId?: string;
  }>;
  authenticationMethod: string;
  observedAt: string;
  proofRef: string;
}>;

export type EvidenceAuthenticator = (
  raw: Uint8Array,
  context: Readonly<{ provider: string; providerAccount: string }>,
) => Promise<AuthenticatedObservation | null>;

export type EvidenceAssessment = Readonly<{
  decision: "acceptance_candidate" | "manual_review";
  reason:
    | "matched"
    | "invalid_record"
    | "secret_unavailable"
    | "key_mismatch"
    | "verifier_unavailable"
    | "unauthenticated"
    | "identity_mismatch"
    | "version_mismatch"
    | "attempt_mismatch"
    | "invalid_proof"
    | "duplicate_proof"
    | "provider_ambiguous"
    | "provider_rejected"
    | "not_found";
  proofDigest?: string;
  proofRef?: string;
  providerMessageId?: string;
}>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const key = /^[0-9a-f]{64}$/;
const label = /^[A-Za-z0-9._:-]{1,128}$/;
const version = /^[A-Za-z0-9._-]{1,32}$/;
const proofReference = /^[A-Za-z0-9._:/-]{1,256}$/;

function sameKey(a: string, b: string): boolean {
  return (
    key.test(a) &&
    key.test(b) &&
    timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"))
  );
}
function review(reason: EvidenceAssessment["reason"]): EvidenceAssessment {
  return { decision: "manual_review", reason };
}
function validObservedAt(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  )
    return false;
  const parsed = new Date(value);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString() ===
      (value.includes(".") ? value : value.replace("Z", ".000Z"))
  );
}

// This result is only a candidate. A future repository must atomically record
// the proof and decision, enforce uniqueness, and check the delivery state.
export async function assessProviderEvidence(
  recorded: RecordedProviderAttempt,
  raw: Uint8Array,
  authenticate: EvidenceAuthenticator | undefined,
  resolveSecret: (version: string) => Uint8Array | undefined,
  knownProofDigests: ReadonlySet<string> = new Set(),
): Promise<EvidenceAssessment> {
  if (
    !recorded ||
    !uuid.test(recorded.deliveryId) ||
    !Number.isSafeInteger(recorded.attemptNumber) ||
    recorded.attemptNumber < 1 ||
    !version.test(recorded.keyVersion) ||
    !key.test(recorded.idempotencyKey) ||
    !label.test(recorded.provider) ||
    !label.test(recorded.providerAccount) ||
    !(raw instanceof Uint8Array) ||
    raw.byteLength === 0 ||
    raw.byteLength > 65536
  )
    return review("invalid_record");

  let secret: Uint8Array | undefined;
  try {
    secret = resolveSecret(recorded.keyVersion);
  } catch {
    return review("secret_unavailable");
  }
  if (!secret) return review("secret_unavailable");
  try {
    if (
      !verifyRecordedAttemptKey(
        recorded,
        () => secret,
        recorded.deliveryId,
        recorded.attemptNumber,
      )
    )
      return review("key_mismatch");
  } catch {
    return review("key_mismatch");
  }
  if (!authenticate) return review("verifier_unavailable");

  const originalBytes = Buffer.from(raw);
  const verificationBytes = Buffer.from(originalBytes);
  const proofDigest = createHash("sha256").update(originalBytes).digest("hex");
  let observation: AuthenticatedObservation | null;
  try {
    observation = await authenticate(verificationBytes, {
      provider: recorded.provider,
      providerAccount: recorded.providerAccount,
    });
  } catch {
    return review("unauthenticated");
  }
  if (!timingSafeEqual(originalBytes, verificationBytes))
    return review("invalid_proof");
  if (!observation || !observation.claims) return review("unauthenticated");
  const claims = observation.claims;
  if (
    claims.provider !== recorded.provider ||
    claims.providerAccount !== recorded.providerAccount
  )
    return review("identity_mismatch");
  if (claims.keyVersion !== recorded.keyVersion)
    return review("version_mismatch");
  if (!sameKey(claims.idempotencyKey, recorded.idempotencyKey))
    return review("attempt_mismatch");
  if (
    !label.test(observation.authenticationMethod) ||
    !proofReference.test(observation.proofRef) ||
    !validObservedAt(observation.observedAt) ||
    !["accepted", "rejected", "ambiguous", "not_found"].includes(
      claims.status,
    ) ||
    (claims.status === "accepted" &&
      (typeof claims.providerMessageId !== "string" ||
        !label.test(claims.providerMessageId)))
  )
    return review("invalid_proof");
  if (knownProofDigests.has(proofDigest)) return review("duplicate_proof");
  if (claims.status === "ambiguous") return review("provider_ambiguous");
  if (claims.status === "rejected") return review("provider_rejected");
  if (claims.status === "not_found") return review("not_found");
  return {
    decision: "acceptance_candidate",
    reason: "matched",
    proofDigest,
    proofRef: observation.proofRef,
    providerMessageId: claims.providerMessageId!,
  };
}
