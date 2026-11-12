import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const LINKS = new Map([
  ["node_modules/@dental-lab/api", "apps/api"],
  ["node_modules/@dental-lab/web", "apps/web"],
  ["node_modules/@dental-lab/contracts", "packages/contracts"],
]);

// Refuse redirected archive sources and missing SRI before npm ci. This is a
// lockfile policy check, not a vulnerability scan or publisher attestation.
export function checkLockfile(lock) {
  if (
    !lock ||
    lock.lockfileVersion !== 3 ||
    !lock.packages ||
    typeof lock.packages !== "object" ||
    Array.isArray(lock.packages)
  )
    throw new Error("LOCKFILE_INVALID");
  const links = new Set();
  for (const [name, entry] of Object.entries(lock.packages)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error("LOCKFILE_ENTRY_INVALID");
    if (entry.link) {
      if (LINKS.get(name) !== entry.resolved || entry.integrity)
        throw new Error("LOCKFILE_LINK_INVALID");
      links.add(name);
      continue;
    }
    if (!name || !name.startsWith("node_modules/")) continue;
    if (
      typeof entry.resolved !== "string" ||
      !/^https:\/\/registry\.npmjs\.org\/[^?#]+\.tgz$/.test(entry.resolved) ||
      typeof entry.integrity !== "string" ||
      !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(entry.integrity)
    )
      throw new Error("LOCKFILE_SOURCE_INVALID");
  }
  if (
    links.size !== LINKS.size ||
    ![...LINKS.keys()].every((name) => links.has(name))
  )
    throw new Error("LOCKFILE_LINK_INVALID");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    checkLockfile(
      JSON.parse(
        await readFile(new URL("../package-lock.json", import.meta.url)),
      ),
    );
    process.stdout.write("Lockfile sources OK\n");
  } catch {
    process.stderr.write("Lockfile source policy failed\n");
    process.exitCode = 1;
  }
}
