import { createHash } from "node:crypto";
import { assertFileSize, boundedUploadBytes } from "./transfer-limits.js";
type Actor = { accountId: string; sessionId: string };
type Lease = { token: string; sizeBytes: number };
type Evidence = { sizeBytes: number; sha256: string };
type Inspection = Evidence & {
  verdict: "clean" | "rejected";
  format: "stl" | "ply" | "obj" | "jpg" | "png" | "heic" | "pdf";
  mediaType: string;
  scannerVersion: string;
  validatorVersion: string;
};
type Ports = {
  // Atomically check live identity, clinic/destination permission, expiry, reserved
  // capacity and session state. Exclusively claim this upload across all workers.
  // Size comes from the session, never a second client declaration.
  claim: (
    actor: Actor,
    uploadId: string,
    signal: AbortSignal,
  ) => Promise<
    | { kind: "claimed"; lease: Lease }
    | { kind: "denied" | "busy" | "capacity" | "unavailable" }
  >;
  // Private opaque lease-bound object, exclusive creation, no symlink following.
  // write must honor backpressure and not retain the caller's mutable buffer.
  open: (
    lease: Lease,
    signal: AbortSignal,
  ) => Promise<{
    write: (bytes: Uint8Array) => Promise<void>;
    seal: () => Promise<Evidence>;
  }>;
  // Fully validate the original format and scan the immutable sealed object.
  // Enforce operator-approved resource/deadline limits; signatures alone are insufficient.
  inspect: (lease: Lease, signal: AbortSignal) => Promise<Inspection>;
  // Transaction: recheck current permission, lease, capacity, immutable evidence,
  // mark session/file ready + audit. No business attachment is created here.
  ready: (
    actor: Actor,
    lease: Lease,
    inspection: Inspection,
    signal: AbortSignal,
  ) => Promise<"ready" | "denied" | "conflict">;
  // Durable reconciliation, not unconditional unlink. Before publication attempt,
  // abort writer and remove only owned unbound temporary bytes under lease lock.
  // Preserve verified resumable chunks according to approved TTL/capacity policy.
  // An uncertain commit MUST retain object/lease until authoritative reconciliation.
  // Not tied to the already-aborted request signal.
  recover: (lease: Lease, outcome: "rejected" | "uncertain") => Promise<void>;
};
export class UploadPipelineError extends Error {
  constructor(
    public readonly code:
      | "dependencies_required"
      | "verification_failed"
      | "upload_failed"
      | "reconciliation_required",
  ) {
    super(code);
    this.name = "UploadPipelineError";
  }
}
const formats = new Set(["stl", "ply", "obj", "jpg", "png", "heic", "pdf"]);
const matches = (a: Evidence, b: Evidence) =>
  a.sizeBytes === b.sizeBytes && a.sha256 === b.sha256;
// Preparation only: no adapters, route or production activation supplied.
// A ready object is private and unattached, never a completed business submission.
export function createUploadPipeline(
  policy: { maxChunkBytes: number },
  ports: Ports,
) {
  assertFileSize(policy.maxChunkBytes);
  for (const key of ["claim", "open", "inspect", "ready", "recover"] as const)
    if (typeof ports[key] !== "function")
      throw new UploadPipelineError("dependencies_required");
  return {
    async receive(
      actor: Actor,
      uploadId: string,
      source: AsyncIterable<Uint8Array>,
      signal: AbortSignal,
    ) {
      signal.throwIfAborted();
      const claim = await ports.claim(actor, uploadId, signal);
      if (claim.kind !== "claimed") return { kind: claim.kind };
      const lease = claim.lease;
      let publicationAttempted = false;
      let recoveryAttempted = false;
      try {
        assertFileSize(lease.sizeBytes);
        if (!lease.token?.trim()) throw new Error("invalid_lease");
        signal.throwIfAborted();
        const sink = await ports.open(lease, signal);
        const hash = createHash("sha256");
        let sizeBytes = 0;
        for await (const chunk of boundedUploadBytes(
          source,
          lease.sizeBytes,
          signal,
        )) {
          if (chunk.byteLength > policy.maxChunkBytes)
            throw new Error("chunk_budget_exceeded");
          // Own the bytes across await so producer buffer reuse cannot change them.
          const bytes = Buffer.from(chunk);
          hash.update(bytes);
          sizeBytes += bytes.byteLength;
          await sink.write(bytes);
        }
        signal.throwIfAborted();
        const expected = { sizeBytes, sha256: hash.digest("hex") };
        const sealed = await sink.seal();
        if (!matches(sealed, expected))
          throw new UploadPipelineError("verification_failed");
        signal.throwIfAborted();
        const checked = await ports.inspect(lease, signal);
        if (
          checked.verdict !== "clean" ||
          !matches(checked, expected) ||
          !formats.has(checked.format) ||
          !checked.mediaType?.trim() ||
          /[\r\n]/.test(checked.mediaType) ||
          !checked.scannerVersion?.trim() ||
          !checked.validatorVersion?.trim()
        )
          throw new UploadPipelineError("verification_failed");
        signal.throwIfAborted();
        publicationAttempted = true;
        const result = await ports.ready(actor, lease, checked, signal);
        if (!["ready", "denied", "conflict"].includes(result))
          throw new Error("invalid_publication_result");
        // A confirmed commit wins over a simultaneous request disconnection.
        if (result !== "ready") {
          recoveryAttempted = true;
          await ports.recover(lease, "rejected");
        }
        return { kind: result };
      } catch (error) {
        if (recoveryAttempted)
          throw new UploadPipelineError("reconciliation_required");
        try {
          await ports.recover(
            lease,
            publicationAttempted ? "uncertain" : "rejected",
          );
        } catch {
          throw new UploadPipelineError("reconciliation_required");
        }
        if (error instanceof UploadPipelineError) throw error;
        throw new UploadPipelineError("upload_failed");
      }
    },
  };
}
