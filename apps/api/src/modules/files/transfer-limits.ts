// Decimal units documented in files-lifecycle H37-01; not an operational disk quota.
export const FILE_MAX_BYTES = 200_000_000;
export const BATCH_MAX_BYTES = 1_000_000_000;
export type AttachmentPurpose =
  "initial_order" | "message" | "order_version" | "followup" | "retouch";
export class TransferLimitError extends Error {
  constructor(
    public readonly code:
      | "invalid_size"
      | "file_too_large"
      | "batch_too_large"
      | "duplicate_file"
      | "invalid_purpose"
      | "invalid_chunk"
      | "size_mismatch",
  ) {
    super(code);
    this.name = "TransferLimitError";
  }
}
export function assertFileSize(size: number): void {
  if (!Number.isSafeInteger(size) || size <= 0)
    throw new TransferLimitError("invalid_size");
  if (size > FILE_MAX_BYTES) throw new TransferLimitError("file_too_large");
}
// Caller supplies sizes from verified server metadata under the binding transaction,
// not browser declarations. This does not establish authority, readiness or capacity.
export function assertAttachmentLimits(
  purpose: AttachmentPurpose,
  files: readonly { id: string; sizeBytes: number }[],
): number {
  if (
    ![
      "initial_order",
      "message",
      "order_version",
      "followup",
      "retouch",
    ].includes(purpose)
  )
    throw new TransferLimitError("invalid_purpose");
  const ids = new Set<string>();
  let total = 0;
  for (const file of files) {
    assertFileSize(file.sizeBytes);
    if (!file.id || ids.has(file.id))
      throw new TransferLimitError("duplicate_file");
    ids.add(file.id);
    if (!Number.isSafeInteger(total + file.sizeBytes))
      throw new TransferLimitError("invalid_size");
    total += file.sizeBytes;
    if (
      (purpose === "initial_order" || purpose === "message") &&
      total > BATCH_MAX_BYTES
    )
      throw new TransferLimitError("batch_too_large");
  }
  return total;
}
// Feed only private quarantine. Full consumption is mandatory before verification;
// yielded bytes are NOT publication or proof of a successful upload.
export async function* boundedUploadBytes(
  source: AsyncIterable<Uint8Array>,
  declaredSize: number,
  signal: AbortSignal,
): AsyncGenerator<Uint8Array> {
  assertFileSize(declaredSize);
  signal.throwIfAborted();
  let received = 0;
  for await (const chunk of source) {
    signal.throwIfAborted();
    if (!(chunk instanceof Uint8Array) || chunk.byteLength === 0)
      throw new TransferLimitError("invalid_chunk");
    if (chunk.byteLength > declaredSize - received)
      throw new TransferLimitError("size_mismatch");
    received += chunk.byteLength;
    yield chunk;
  }
  signal.throwIfAborted();
  if (received !== declaredSize) throw new TransferLimitError("size_mismatch");
}
