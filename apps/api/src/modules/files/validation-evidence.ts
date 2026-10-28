import type { FileFormat } from "./format-probe.js";
import { assertFileSize } from "./transfer-limits.js";

type ObjectReceipt = {
  objectKey: string;
  sizeBytes: number;
  sha256: string;
  format: FileFormat;
};
type Check = {
  objectKey: string;
  sizeBytes: number;
  sha256: string;
  verdict: "clean" | "rejected" | "unknown";
  version: string;
  reference: string;
};
type Checker = (
  object: Readonly<ObjectReceipt>,
  signal: AbortSignal,
) => Promise<Check>;
type Verify = (key: string, size: number, sha: string) => Promise<boolean>;
const shaPattern = /^[0-9a-f]{64}$/;
const keyPattern = /^[0-9a-f]{64}$/;
function matches(check: Check, object: ObjectReceipt, version: string) {
  return (
    check &&
    check.objectKey === object.objectKey &&
    check.sizeBytes === object.sizeBytes &&
    check.sha256 === object.sha256 &&
    check.verdict === "clean" &&
    check.version === version &&
    typeof check.reference === "string" &&
    /^[a-zA-Z0-9._:-]{1,128}$/.test(check.reference)
  );
}
// Server composition only. The ports must be real, independently qualified
// analyzers; this result never grants publication or business attachment.
export function createValidationEvidence(
  verify: Verify,
  parser: Checker | undefined,
  scanner: Checker | undefined,
  policy: { version: string; parserVersion: string; scannerVersion: string },
) {
  if (
    typeof verify !== "function" ||
    !policy.version?.trim() ||
    !policy.parserVersion?.trim() ||
    !policy.scannerVersion?.trim()
  )
    throw new Error("FILE_VALIDATION_POLICY_REQUIRED");
  return {
    async inspect(object: ObjectReceipt, signal: AbortSignal) {
      if (
        !keyPattern.test(object.objectKey) ||
        !shaPattern.test(object.sha256) ||
        !["stl", "ply", "obj", "jpg", "png", "heic", "pdf"].includes(
          object.format,
        )
      )
        return { kind: "blocked" as const };
      assertFileSize(object.sizeBytes);
      if (typeof parser !== "function" || typeof scanner !== "function")
        return { kind: "blocked" as const };
      signal.throwIfAborted();
      try {
        if (
          (await verify(object.objectKey, object.sizeBytes, object.sha256)) !==
          true
        )
          return { kind: "blocked" as const };
        const structure = await parser(Object.freeze({ ...object }), signal);
        if (!matches(structure, object, policy.parserVersion))
          return { kind: "blocked" as const };
        signal.throwIfAborted();
        const malware = await scanner(Object.freeze({ ...object }), signal);
        if (!matches(malware, object, policy.scannerVersion))
          return { kind: "blocked" as const };
        signal.throwIfAborted();
        if (
          (await verify(object.objectKey, object.sizeBytes, object.sha256)) !==
          true
        )
          return { kind: "blocked" as const };
        return {
          kind: "evidence" as const,
          object: { ...object },
          policyVersion: policy.version,
          parser: {
            version: structure.version,
            reference: structure.reference,
          },
          scanner: { version: malware.version, reference: malware.reference },
        };
      } catch {
        return { kind: "blocked" as const };
      }
    },
  };
}
