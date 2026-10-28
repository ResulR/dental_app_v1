import { test, expect } from "vitest";
import { createValidationEvidence } from "../../apps/api/src/modules/files/validation-evidence.ts";
const object = {
  objectKey: "a".repeat(64),
  sha256: "b".repeat(64),
  sizeBytes: 134,
  format: "stl",
};
const policy = {
  version: "policy-1",
  parserVersion: "parser-1",
  scannerVersion: "scanner-1",
};
const check =
  (version, patch = {}) =>
  async (receipt) => ({
    ...receipt,
    verdict: "clean",
    version,
    reference: "synthetic:test",
    ...patch,
  });
const signal = new globalThis.AbortController().signal;
test("missing, ambiguous, mismatched and stale analyzers keep the sealed object blocked", async () => {
  const verify = async () => true;
  expect(
    (
      await createValidationEvidence(
        async () => false,
        check("parser-1"),
        check("scanner-1"),
        policy,
      ).inspect(object, signal)
    ).kind,
  ).toBe("blocked");
  expect(
    (
      await createValidationEvidence(
        verify,
        undefined,
        undefined,
        policy,
      ).inspect(object, signal)
    ).kind,
  ).toBe("blocked");
  for (const [parser, scanner] of [
    [check("parser-1", { sha256: "c".repeat(64) }), check("scanner-1")],
    [check("parser-1"), check("scanner-old")],
    [check("parser-1"), check("scanner-1", { verdict: "unknown" })],
    [
      check("parser-1"),
      async () => {
        throw new Error("unavailable");
      },
    ],
  ])
    expect(
      (
        await createValidationEvidence(verify, parser, scanner, policy).inspect(
          object,
          signal,
        )
      ).kind,
    ).toBe("blocked");
});
test("trusted synthetic ports only produce an internal evidence candidate, verified twice", async () => {
  let verified = 0;
  const gate = createValidationEvidence(
    async () => {
      verified++;
      return true;
    },
    check("parser-1"),
    check("scanner-1"),
    policy,
  );
  expect(await gate.inspect(object, signal)).toMatchObject({
    kind: "evidence",
    object,
    policyVersion: "policy-1",
    parser: { reference: "synthetic:test" },
    scanner: { reference: "synthetic:test" },
  });
  expect(verified).toBe(2);
});
