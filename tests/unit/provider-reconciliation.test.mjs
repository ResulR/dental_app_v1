import { expect, test } from "vitest";
import {
  providerAttemptKey,
  reconcileAmbiguous,
  versionedProviderAttemptKey,
  verifyRecordedAttemptKey,
} from "../../apps/api/dist/modules/notifications/provider-reconciliation.js";
const secret = new Uint8Array(32).fill(7);
const id = "75000000-0000-4000-8000-000000000001";
test("domain-separated stable keys bind each delivery attempt without exposing identifiers", () => {
  const key = providerAttemptKey(secret, id, 1);
  expect(key).toMatch(/^[0-9a-f]{64}$/);
  expect(key).toBe(providerAttemptKey(secret, id.toUpperCase(), 1));
  expect(key).not.toBe(providerAttemptKey(secret, id, 2));
  expect(key).not.toContain(id);
  expect(() => providerAttemptKey(new Uint8Array(8), id, 1)).toThrow();
  expect(() => providerAttemptKey(secret, "invalid", 1)).toThrow();
});
test("only verified acceptance of the exact attempt can resolve ambiguity", () => {
  const key = providerAttemptKey(secret, id, 1);
  expect(
    reconcileAmbiguous(
      key,
      {
        kind: "verified_acceptance",
        idempotencyKey: key,
        providerId: "fake:1",
      },
      () => true,
    ), // synthetic trusted-adapter double, not provider authentication
  ).toEqual({ decision: "accepted", providerId: "fake:1" });
  for (const evidence of [
    { kind: "not_found", idempotencyKey: key },
    { kind: "verified_rejection", idempotencyKey: key },
    { kind: "unavailable" },
  ])
    expect(reconcileAmbiguous(key, evidence)).toEqual({
      decision: "manual_review",
    });
  expect(() =>
    reconcileAmbiguous(key, {
      kind: "verified_acceptance",
      idempotencyKey: "0".repeat(64),
      providerId: "fake:1",
    }),
  ).toThrow();
  expect(() =>
    reconcileAmbiguous(key, {
      kind: "verified_acceptance",
      idempotencyKey: key,
      providerId: "private@example.test",
    }),
  ).toThrow();
});

test("key rotation must preserve the original attempt key", () => {
  const original = providerAttemptKey(secret, id, 1);
  const rotated = providerAttemptKey(new Uint8Array(32).fill(9), id, 1);
  expect(rotated).not.toBe(original);
  expect(() =>
    reconcileAmbiguous(original, {
      kind: "verified_acceptance",
      idempotencyKey: rotated,
      providerId: "fake:2",
    }),
  ).toThrow("PROVIDER_EVIDENCE_INVALID");
});

test("rotation retains the original version and refuses missing or mismatched keys", () => {
  const old = versionedProviderAttemptKey("k-2026-a", secret, id, 2);
  const current = new Uint8Array(32).fill(9);
  const ring = new Map([
    ["k-2026-a", secret],
    ["k-2026-b", current],
  ]);
  expect(
    verifyRecordedAttemptKey(old, (version) => ring.get(version), id, 2),
  ).toBe(true);
  expect(
    verifyRecordedAttemptKey(old, (version) => ring.get(version), id, 1),
  ).toBe(false);
  expect(
    verifyRecordedAttemptKey(
      old,
      (version) => ring.get(version),
      "75000000-0000-4000-8000-000000000002",
      2,
    ),
  ).toBe(false);
  expect(
    verifyRecordedAttemptKey(
      { ...old, keyVersion: "k-2026-b" },
      (version) => ring.get(version),
      id,
      2,
    ),
  ).toBe(false);
  // Even reusing the same secret under a new label cannot alias the old key.
  expect(
    verifyRecordedAttemptKey(
      { ...old, keyVersion: "k-2026-b" },
      () => secret,
      id,
      2,
    ),
  ).toBe(false);
  ring.delete("k-2026-a");
  expect(
    verifyRecordedAttemptKey(old, (version) => ring.get(version), id, 2),
  ).toBe(false);
  expect(() =>
    versionedProviderAttemptKey("invalid/version", secret, id, 2),
  ).toThrow();
  expect(() =>
    verifyRecordedAttemptKey(
      { ...old, idempotencyKey: "x" },
      () => secret,
      id,
      2,
    ),
  ).toThrow();
});

// These are boundary tests of the local protocol, not provider authentication.
test("each versioned attempt has a distinct, stable key and historical secret is mandatory", () => {
  const secondId = "75000000-0000-4000-8000-000000000002";
  const first = versionedProviderAttemptKey("old", secret, id, 1);
  expect(versionedProviderAttemptKey("old", secret, id, 1)).toEqual(first);
  expect(
    versionedProviderAttemptKey("old", secret, id, 2).idempotencyKey,
  ).not.toBe(first.idempotencyKey);
  expect(
    versionedProviderAttemptKey("old", secret, secondId, 1).idempotencyKey,
  ).not.toBe(first.idempotencyKey);
  expect(
    versionedProviderAttemptKey("new", secret, id, 1).idempotencyKey,
  ).not.toBe(first.idempotencyKey);
  let requestedVersion;
  expect(
    verifyRecordedAttemptKey(
      first,
      (version) => {
        requestedVersion = version;
        return undefined;
      },
      id,
      1,
    ),
  ).toBe(false);
  expect(requestedVersion).toBe("old");
  expect(
    verifyRecordedAttemptKey(first, () => new Uint8Array(32).fill(9), id, 1),
  ).toBe(false);
});

test("raw acceptance assertions fail closed without a trusted verifier", () => {
  const recorded = versionedProviderAttemptKey("old", secret, id, 1);
  const untrusted = JSON.parse(
    JSON.stringify({
      kind: "verified_acceptance",
      idempotencyKey: recorded.idempotencyKey,
      providerId: "fabricated:receipt",
    }),
  );
  expect(reconcileAmbiguous(recorded.idempotencyKey, untrusted)).toEqual({
    decision: "manual_review",
  });
  expect(
    reconcileAmbiguous(recorded.idempotencyKey, untrusted, () => false),
  ).toEqual({
    decision: "manual_review",
  });
  expect(() =>
    reconcileAmbiguous(recorded.idempotencyKey, untrusted, () => {
      throw new Error("AUTHENTICATION_UNAVAILABLE");
    }),
  ).toThrow("AUTHENTICATION_UNAVAILABLE");
  expect(
    reconcileAmbiguous(recorded.idempotencyKey, {
      kind: "not_found",
      idempotencyKey: recorded.idempotencyKey,
    }),
  ).toEqual({ decision: "manual_review" });
});

test("an asynchronous verifier is not treated as an authenticated result", () => {
  const key = providerAttemptKey(secret, id, 1);
  expect(
    reconcileAmbiguous(
      key,
      {
        kind: "verified_acceptance",
        idempotencyKey: key,
        providerId: "fake:1",
      },
      () => Promise.resolve(true),
    ),
  ).toEqual({ decision: "manual_review" });
});
