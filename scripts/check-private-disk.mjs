import { statfs, lstat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// A read-only probe for an external supervisor. It does not reserve capacity,
// remove objects, or install a job. Thresholds must be provided by the operator.
export async function checkPrivateDisk(root, minimumFreeBytes, probe = statfs) {
  if (
    typeof root !== "string" ||
    !path.isAbsolute(root) ||
    !Number.isSafeInteger(minimumFreeBytes) ||
    minimumFreeBytes <= 0
  )
    throw new Error("DISK_MONITOR_POLICY_REQUIRED");
  const directory = await lstat(root);
  if (!directory.isDirectory() || directory.isSymbolicLink())
    throw new Error("DISK_MONITOR_ROOT_INVALID");
  const space = await probe(root);
  const available = Number(space.bavail) * Number(space.bsize);
  if (!Number.isSafeInteger(available) || available < 0)
    throw new Error("DISK_MONITOR_PROBE_INVALID");
  return {
    state: available < minimumFreeBytes ? "low" : "ok",
    availableBytes: available,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const [root, threshold, ...extra] = process.argv.slice(2);
  if (extra.length || !/^[1-9][0-9]*$/.test(threshold ?? "")) {
    process.stderr.write(
      "Usage: node scripts/check-private-disk.mjs ABSOLUTE_PRIVATE_ROOT MINIMUM_FREE_BYTES\n",
    );
    process.exitCode = 3;
  } else {
    try {
      const result = await checkPrivateDisk(root, Number(threshold));
      process.stdout.write(JSON.stringify(result) + "\n");
      process.exitCode = result.state === "ok" ? 0 : 2;
    } catch {
      process.stderr.write("Private disk status unavailable\n");
      process.exitCode = 3;
    }
  }
}
