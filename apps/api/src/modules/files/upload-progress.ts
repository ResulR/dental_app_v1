import { assertFileSize, FILE_MAX_BYTES } from "./transfer-limits.js";
type Receipt = { index: number; sizeBytes: number; sha256: string };
// Receipts must come from the authorized, locked upload session in PostgreSQL.
// This only plans explicit resumptions; it never infers authority from a hash.
export function uploadProgress(
  declaredSize: number,
  chunkSize: number,
  receipts: readonly Receipt[],
  maxSegments: number,
) {
  assertFileSize(declaredSize);
  if (
    !Number.isSafeInteger(chunkSize) ||
    chunkSize <= 0 ||
    chunkSize > FILE_MAX_BYTES ||
    !Number.isSafeInteger(maxSegments) ||
    maxSegments <= 0
  )
    throw new Error("UPLOAD_PROGRESS_POLICY");
  const count = Math.ceil(declaredSize / chunkSize);
  if (count > maxSegments) throw new Error("UPLOAD_PROGRESS_POLICY");
  const verified = new Set<number>();
  let receivedBytes = 0;
  for (const row of receipts) {
    if (
      !Number.isSafeInteger(row.index) ||
      row.index < 0 ||
      row.index >= count ||
      verified.has(row.index) ||
      row.sizeBytes !==
        Math.min(chunkSize, declaredSize - row.index * chunkSize) ||
      !/^[0-9a-f]{64}$/.test(row.sha256)
    )
      throw new Error("UPLOAD_PROGRESS_INCONSISTENT");
    verified.add(row.index);
    receivedBytes += row.sizeBytes;
  }
  const missing: number[] = [];
  for (let index = 0; index < count; index++)
    if (!verified.has(index)) missing.push(index);
  return {
    receivedBytes,
    declaredSize,
    complete: missing.length === 0,
    missing,
  };
}
