import { createHmac, timingSafeEqual } from "node:crypto";
import { TextDecoder, TextEncoder } from "node:util";
import { expect, test } from "vitest";
import { versionedProviderAttemptKey } from "../../apps/api/dist/modules/notifications/provider-reconciliation.js";
import { assessProviderEvidence } from "../../apps/api/dist/modules/notifications/provider-evidence.js";

const deliveryId = "75000000-0000-4000-8000-000000000001";
const historical = new Uint8Array(32).fill(7);
const signingSecret = new Uint8Array(32).fill(4); // synthetic adapter key, never a credential
const recorded = {
  deliveryId,
  attemptNumber: 2,
  provider: "synthetic-provider",
  providerAccount: "synthetic-account",
  ...versionedProviderAttemptKey("old", historical, deliveryId, 2),
};
const claims = {
  provider: recorded.provider,
  providerAccount: recorded.providerAccount,
  keyVersion: recorded.keyVersion,
  idempotencyKey: recorded.idempotencyKey,
  status: "accepted",
  providerMessageId: "fake:receipt-2",
};
const metadata = {
  authenticationMethod: "synthetic-hmac",
  observedAt: "2026-10-27T13:00:00Z",
  proofRef: "private:synthetic-proof-2",
};
const ring = (version) => (version === "old" ? historical : undefined);
function sign(value) {
  const payload = JSON.stringify(value);
  const signature = createHmac("sha256", signingSecret)
    .update(payload)
    .digest("hex");
  return new TextEncoder().encode(JSON.stringify({ payload, signature }));
}
// Synthetic authenticated adapter: demonstrates the boundary, not any real
// provider's signature algorithm, account semantics, or proof storage.
async function authenticate(raw) {
  const { payload, signature } = JSON.parse(new TextDecoder().decode(raw));
  const expected = createHmac("sha256", signingSecret)
    .update(payload)
    .digest("hex");
  if (
    typeof signature !== "string" ||
    !/^[0-9a-f]{64}$/.test(signature) ||
    !timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex"),
    )
  )
    return null;
  return { claims: JSON.parse(payload), ...metadata };
}
const valid = sign(claims);
const assess = (
  record = recorded,
  raw = valid,
  verifier = authenticate,
  resolver = ring,
  known = new Set(),
) => assessProviderEvidence(record, raw, verifier, resolver, known);

test("authenticated and correlated proof is only an acceptance candidate", async () => {
  const result = await assess();
  expect(result).toMatchObject({
    decision: "acceptance_candidate",
    reason: "matched",
    providerMessageId: "fake:receipt-2",
    proofRef: metadata.proofRef,
  });
  expect(result.proofDigest).toMatch(/^[0-9a-f]{64}$/);
});
test("tampered signed payload and unauthenticated JSON require manual review", async () => {
  const envelope = JSON.parse(new TextDecoder().decode(valid));
  envelope.payload = JSON.stringify({ ...claims, status: "rejected" });
  expect(
    await assess(recorded, new TextEncoder().encode(JSON.stringify(envelope))),
  ).toMatchObject({ decision: "manual_review", reason: "unauthenticated" });
  expect(
    await assess(recorded, new TextEncoder().encode(JSON.stringify(claims))),
  ).toMatchObject({ decision: "manual_review", reason: "unauthenticated" });
});
test("another attempt or an old proof replayed against a new attempt fails", async () => {
  const next = {
    ...recorded,
    attemptNumber: 3,
    ...versionedProviderAttemptKey("old", historical, deliveryId, 3),
  };
  expect(await assess(next)).toMatchObject({
    decision: "manual_review",
    reason: "attempt_mismatch",
  });
  expect(
    await assess({ ...recorded, idempotencyKey: "0".repeat(64) }),
  ).toMatchObject({ decision: "manual_review", reason: "key_mismatch" });
});
test("wrong key version fails even when the secret bytes are reused", async () => {
  const next = { ...recorded, keyVersion: "new" };
  expect(
    await assess(next, valid, authenticate, () => historical),
  ).toMatchObject({ decision: "manual_review", reason: "key_mismatch" });
  expect(
    await assess(recorded, sign({ ...claims, keyVersion: "new" })),
  ).toMatchObject({ decision: "manual_review", reason: "version_mismatch" });
});
test("provider and provider account must match the recorded attempt", async () => {
  for (const change of [
    { provider: "other" },
    { providerAccount: "other-account" },
  ])
    expect(
      await assess(recorded, sign({ ...claims, ...change })),
    ).toMatchObject({ decision: "manual_review", reason: "identity_mismatch" });
});
test("duplicate proof and ambiguous, rejected or absent results never accept", async () => {
  const first = await assess();
  expect(
    await assess(
      recorded,
      valid,
      authenticate,
      ring,
      new Set([first.proofDigest]),
    ),
  ).toMatchObject({ decision: "manual_review", reason: "duplicate_proof" });
  for (const [status, reason] of [
    ["ambiguous", "provider_ambiguous"],
    ["rejected", "provider_rejected"],
    ["not_found", "not_found"],
  ])
    expect(await assess(recorded, sign({ ...claims, status }))).toMatchObject({
      decision: "manual_review",
      reason,
    });
});
test("missing or failing verifier, and unavailable historical secret fail closed", async () => {
  expect(
    await assessProviderEvidence(recorded, valid, undefined, ring),
  ).toMatchObject({
    decision: "manual_review",
    reason: "verifier_unavailable",
  });
  expect(
    await assess(recorded, valid, async () => {
      throw Error("offline");
    }),
  ).toMatchObject({ decision: "manual_review", reason: "unauthenticated" });
  expect(
    await assess(recorded, valid, authenticate, () => undefined),
  ).toMatchObject({ decision: "manual_review", reason: "secret_unavailable" });
});
test("invalid timestamps, reference, provider receipt and payload size fail closed", async () => {
  const badMetadata = async () => ({
    claims,
    ...metadata,
    observedAt: "yesterday",
  });
  expect(await assess(recorded, valid, badMetadata)).toMatchObject({
    decision: "manual_review",
    reason: "invalid_proof",
  });
  expect(
    await assess(recorded, valid, async () => ({
      claims: { ...claims, providerMessageId: "private@example.test" },
      ...metadata,
    })),
  ).toMatchObject({ decision: "manual_review", reason: "invalid_proof" });
  expect(await assess(recorded, new Uint8Array(65537))).toMatchObject({
    decision: "manual_review",
    reason: "invalid_record",
  });
});

test("invalid calendar date and verifier mutation cannot produce a candidate", async () => {
  expect(
    await assess(recorded, valid, async () => ({
      claims,
      ...metadata,
      observedAt: "2026-02-31T13:00:00Z",
    })),
  ).toMatchObject({ decision: "manual_review", reason: "invalid_proof" });
  expect(
    await assess(recorded, valid, async (bytes) => {
      bytes[0] ^= 1;
      return { claims, ...metadata };
    }),
  ).toMatchObject({ decision: "manual_review", reason: "invalid_proof" });
});
