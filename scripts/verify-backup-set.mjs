import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { verifyBackupInventory } from "./verify-backup-inventory.mjs";

const SHA = /^[a-f0-9]{64}$/;
const KEY = /^[a-f0-9]{32,64}$/;
const MAX_MANIFEST_BYTES = 16 * 1024 * 1024;
const MAX_OBJECTS = 100_000;

async function directory(dir) {
  const info = await lstat(dir);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error("BACKUP_ROOT_INVALID");
}

async function verifyEntry(file, expected) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isFile()) throw new Error("BACKUP_ENTRY_INVALID");
    if (before.size !== expected.bytes) throw new Error("BACKUP_SIZE_MISMATCH");
    const hash = createHash("sha256");
    for await (const chunk of handle.createReadStream({
      highWaterMark: 1024 * 1024,
      start: 0,
      end: expected.bytes - 1,
      autoClose: false,
    }))
      hash.update(chunk);
    const after = await handle.stat();
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs
    )
      throw new Error("BACKUP_ENTRY_CHANGED");
    if (hash.digest("hex") !== expected.sha256)
      throw new Error("BACKUP_HASH_MISMATCH");
  } finally {
    await handle.close();
  }
}

async function readInventory(file, expected) {
  if (!validEntry(expected) || expected.bytes > MAX_MANIFEST_BYTES)
    throw new Error("BACKUP_INVENTORY_INVALID");
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size !== expected.bytes)
      throw new Error("BACKUP_INVENTORY_INVALID");
    const bytes = Buffer.alloc(expected.bytes);
    for (let offset = 0; offset < bytes.length;) {
      const { bytesRead } = await handle.read(
        bytes,
        offset,
        bytes.length - offset,
        offset,
      );
      if (!bytesRead) throw new Error("BACKUP_INVENTORY_INVALID");
      offset += bytesRead;
    }
    const after = await handle.stat();
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs ||
      createHash("sha256").update(bytes).digest("hex") !== expected.sha256
    )
      throw new Error("BACKUP_INVENTORY_INVALID");
    return JSON.parse(bytes.toString("utf8"));
  } finally {
    await handle.close();
  }
}

function validEntry(entry) {
  return (
    entry &&
    typeof entry === "object" &&
    !Array.isArray(entry) &&
    Number.isSafeInteger(entry.bytes) &&
    entry.bytes > 0 &&
    SHA.test(entry.sha256)
  );
}

// Offline preflight of an already decrypted, isolated backup set. It does not
// authenticate the source, create a backup, restore data, or prove DB/object
// snapshot consistency. The operator must verify those separately.
export async function verifyBackupSet(root) {
  if (typeof root !== "string" || !path.isAbsolute(root))
    throw new Error("BACKUP_ROOT_INVALID");
  await directory(root);
  await directory(path.join(root, "objects"));
  const manifestHandle = await open(
    path.join(root, "manifest.json"),
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  let manifest;
  try {
    const info = await manifestHandle.stat();
    if (!info.isFile() || info.size > MAX_MANIFEST_BYTES)
      throw new Error("BACKUP_MANIFEST_INVALID");
    const bytes = Buffer.alloc(info.size);
    for (let offset = 0; offset < bytes.length;) {
      const { bytesRead } = await manifestHandle.read(
        bytes,
        offset,
        bytes.length - offset,
        offset,
      );
      if (!bytesRead) throw new Error("BACKUP_MANIFEST_INVALID");
      offset += bytesRead;
    }
    const after = await manifestHandle.stat();
    if (
      after.size !== info.size ||
      after.mtimeMs !== info.mtimeMs ||
      after.ctimeMs !== info.ctimeMs
    )
      throw new Error("BACKUP_MANIFEST_INVALID");
    manifest = JSON.parse(bytes.toString("utf8"));
  } finally {
    await manifestHandle.close();
  }
  if (
    !manifest ||
    (manifest.version !== 1 && manifest.version !== 2) ||
    typeof manifest.snapshotAt !== "string" ||
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T.*Z$/.test(manifest.snapshotAt) ||
    Number.isNaN(Date.parse(manifest.snapshotAt)) ||
    !validEntry(manifest.database) ||
    !Array.isArray(manifest.objects) ||
    manifest.objects.length > MAX_OBJECTS
  )
    throw new Error("BACKUP_MANIFEST_INVALID");
  const seen = new Set();
  for (const object of manifest.objects) {
    if (
      !validEntry(object) ||
      typeof object.key !== "string" ||
      !KEY.test(object.key) ||
      seen.has(object.key)
    )
      throw new Error("BACKUP_MANIFEST_INVALID");
    seen.add(object.key);
  }
  if (manifest.version === 2 && !validEntry(manifest.inventory))
    throw new Error("BACKUP_MANIFEST_INVALID");
  await verifyEntry(path.join(root, "database.dump"), manifest.database);
  for (const object of manifest.objects)
    await verifyEntry(path.join(root, "objects", object.key), object);
  const checked =
    manifest.version === 2
      ? verifyBackupInventory(
          manifest,
          await readInventory(
            path.join(root, "inventory.json"),
            manifest.inventory,
          ),
        )
      : null;
  return {
    snapshotAt: manifest.snapshotAt,
    objectCount: seen.size,
    ...(checked
      ? { fileCount: checked.fileCount, bindingCount: checked.bindingCount }
      : {}),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const [root, ...extra] = process.argv.slice(2);
  try {
    if (extra.length) throw new Error("BACKUP_ROOT_INVALID");
    const result = await verifyBackupSet(root);
    process.stdout.write(JSON.stringify(result) + "\n");
  } catch {
    process.stderr.write("Backup set preflight failed\n");
    process.exitCode = 1;
  }
}
