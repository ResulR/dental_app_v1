import { statfs } from "node:fs/promises";
// Admission guard only. A durable, serialized reservation by the upload session
// must also succeed; a filesystem snapshot alone cannot reserve shared VPS disk.
export async function requireDiskHeadroom(
  privateRoot: string,
  incomingBytes: number,
  minimumFreeBytes: number,
  probe: typeof statfs = statfs,
) {
  if (
    !Number.isSafeInteger(incomingBytes) ||
    incomingBytes <= 0 ||
    !Number.isSafeInteger(minimumFreeBytes) ||
    minimumFreeBytes <= 0
  )
    throw new Error("DISK_POLICY_REQUIRED");
  const space = await probe(privateRoot);
  const available = Number(space.bavail) * Number(space.bsize);
  if (
    !Number.isSafeInteger(available) ||
    available < incomingBytes ||
    available - incomingBytes < minimumFreeBytes
  )
    return { kind: "paused" as const };
  return { kind: "admissible" as const };
}
