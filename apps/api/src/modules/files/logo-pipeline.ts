import { createHash, randomUUID } from "node:crypto";
type Actor = { accountId: string; sessionId: string };
type Policy = {
  maxUploadBytes: number;
  maxNormalizedBytes: number;
  maxPixels: number;
  maxChunks: number;
};
type CheckedImage = {
  bytes: Uint8Array;
  mime: "image/png";
  width: number;
  height: number;
  sourceSha256: string;
  scannerVersion: string;
  decoderVersion: string;
};
type Ports = {
  // Current server-side settings.manage. Never accept a client profile/grants.
  authorize: (actor: Actor) => Promise<boolean>;
  // Must atomically reserve private quarantine + normalized image capacity.
  reserve: (bytes: number) => Promise<string | null>;
  quarantine: (input: {
    id: string;
    reservationId: string;
    bytes: Uint8Array;
    sha256: string;
  }) => Promise<void>;
  // Fully decode/re-encode into inert PNG, strip metadata and scan BOTH source and
  // derivative under operator-selected CPU/time/memory bounds. Signature is not scan.
  inspect: (input: {
    id: string;
    source: Uint8Array;
    sha256: string;
    maxPixels: number;
    maxBytes: number;
  }) => Promise<CheckedImage>;
  // Verify lease, immutable object/hash and current permission + revision INSIDE
  // the publication transaction with history/audit. Never publish on this callback's failure.
  publish: (input: {
    id: string;
    actor: Actor;
    expectedRevision: number;
    reservationId: string;
    image: Uint8Array;
    sha256: string;
    sourceSha256: string;
    width: number;
    height: number;
    scannerVersion: string;
    decoderVersion: string;
  }) => Promise<"published" | "conflict" | "denied">;
  // Preserve evidence/quarantine and release only unused reserved capacity; never
  // delete a potentially committed object after an uncertain publication.
  retain: (input: {
    id: string;
    reservationId: string;
    outcome: "uncertain" | "rejected";
  }) => Promise<void>;
};
const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
// Preparation only. No filesystem/SQL/provider implementation, default policy,
// runtime binding or public route is supplied until the mandatory adapters exist.
export function createLogoPipeline(policy: Policy, ports: Ports) {
  for (const value of [
    policy.maxUploadBytes,
    policy.maxNormalizedBytes,
    policy.maxPixels,
    policy.maxChunks,
  ]) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new Error("LOGO_POLICY_REQUIRED");
  }
  if (!Number.isSafeInteger(policy.maxUploadBytes + policy.maxNormalizedBytes))
    throw new Error("LOGO_POLICY_REQUIRED");
  for (const name of [
    "authorize",
    "reserve",
    "quarantine",
    "inspect",
    "publish",
    "retain",
  ] as const)
    if (typeof ports[name] !== "function")
      throw new Error("LOGO_DEPENDENCIES_REQUIRED");
  let occupied = false;
  return {
    async prepareAndPublish(
      actor: Actor,
      expectedRevision: number,
      source: AsyncIterable<Uint8Array>,
    ) {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
        throw new Error("LOGO_INVALID_REVISION");
      if (occupied) return { kind: "busy" as const };
      occupied = true;
      let reservationId: string | null = null,
        id: string | undefined,
        publishing = false,
        retentionAttempted = false;
      try {
        if (!(await ports.authorize(actor))) return { kind: "denied" as const };
        reservationId = await ports.reserve(
          policy.maxUploadBytes + policy.maxNormalizedBytes,
        );
        if (!reservationId) return { kind: "capacity" as const };
        id = randomUUID();
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of source) {
          if (
            !(chunk instanceof Uint8Array) ||
            chunk.byteLength === 0 ||
            chunks.length >= policy.maxChunks ||
            chunk.byteLength > policy.maxUploadBytes - size
          )
            throw new Error("LOGO_UPLOAD_REJECTED");
          size += chunk.byteLength;
          chunks.push(Buffer.from(chunk));
        }
        if (!size) throw new Error("LOGO_UPLOAD_REJECTED");
        const bytes = Buffer.concat(chunks),
          sourceSha256 = digest(bytes);
        await ports.quarantine({
          id,
          reservationId,
          bytes,
          sha256: sourceSha256,
        });
        const checked = await ports.inspect({
          id,
          source: bytes,
          sha256: sourceSha256,
          maxPixels: policy.maxPixels,
          maxBytes: policy.maxNormalizedBytes,
        });
        if (
          checked.mime !== "image/png" ||
          !(checked.bytes instanceof Uint8Array) ||
          checked.bytes.byteLength < 24 ||
          checked.bytes.byteLength > policy.maxNormalizedBytes ||
          checked.sourceSha256 !== sourceSha256 ||
          digest(bytes) !== sourceSha256 ||
          !Number.isSafeInteger(checked.width) ||
          checked.width <= 0 ||
          !Number.isSafeInteger(checked.height) ||
          checked.height <= 0 ||
          checked.width > Math.floor(policy.maxPixels / checked.height) ||
          !checked.scannerVersion?.trim() ||
          !checked.decoderVersion?.trim()
        )
          throw new Error("LOGO_VALIDATION_REJECTED");
        const image = Buffer.from(checked.bytes);
        // Structural cross-check only; the trusted adapter must perform complete decoding.
        if (
          !image.subarray(0, 8).equals(png) ||
          image.readUInt32BE(8) !== 13 ||
          image.toString("ascii", 12, 16) !== "IHDR" ||
          image.readUInt32BE(16) !== checked.width ||
          image.readUInt32BE(20) !== checked.height
        )
          throw new Error("LOGO_VALIDATION_REJECTED");
        if (!(await ports.authorize(actor))) {
          retentionAttempted = true;
          await ports.retain({ id, reservationId, outcome: "rejected" });
          return { kind: "denied" as const };
        }
        publishing = true;
        const kind = await ports.publish({
          id,
          actor,
          expectedRevision,
          reservationId,
          image,
          sha256: digest(image),
          sourceSha256,
          width: checked.width,
          height: checked.height,
          scannerVersion: checked.scannerVersion,
          decoderVersion: checked.decoderVersion,
        });
        if (!["published", "conflict", "denied"].includes(kind))
          throw new Error("LOGO_PUBLICATION_INVALID");
        if (kind !== "published") {
          retentionAttempted = true;
          await ports.retain({ id, reservationId, outcome: "rejected" });
        }
        return { kind };
      } catch {
        if (retentionAttempted)
          throw new Error("LOGO_EVIDENCE_RETENTION_FAILED");
        if (reservationId && id) {
          try {
            await ports.retain({
              id,
              reservationId,
              outcome: publishing ? "uncertain" : "rejected",
            });
          } catch {
            throw new Error("LOGO_EVIDENCE_RETENTION_FAILED");
          }
        }
        throw new Error("LOGO_PIPELINE_FAILED");
      } finally {
        occupied = false;
      }
    },
  };
}
