import { constants } from "node:fs";
import {
  copyFile,
  lstat,
  mkdtemp,
  open,
  realpath,
  rm,
  mkdir,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyBackupSet } from "./verify-backup-set.mjs";

const scratch = path.resolve(
  fileURLToPath(new URL("../.local/", import.meta.url)),
);
const MAX_REHEARSAL_BYTES = 32 * 1024 * 1024;

async function readBoundedManifest(source) {
  const handle = await open(
    path.join(source, "manifest.json"),
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size <= 0 || info.size > 16 * 1024 * 1024)
      throw new Error("RESTORE_MANIFEST_INVALID");
    const bytes = Buffer.alloc(info.size);
    for (let offset = 0; offset < bytes.length;) {
      const { bytesRead } = await handle.read(
        bytes,
        offset,
        bytes.length - offset,
        offset,
      );
      if (!bytesRead) throw new Error("RESTORE_MANIFEST_INVALID");
      offset += bytesRead;
    }
    const manifest = JSON.parse(bytes.toString("utf8"));
    if (
      !Array.isArray(manifest.objects) ||
      manifest.objects.length > 100_000 ||
      manifest.objects.some((item) => !/^[a-f0-9]{32,64}$/.test(item.key))
    )
      throw new Error("RESTORE_MANIFEST_INVALID");
    return manifest;
  } finally {
    await handle.close();
  }
}

// Filesystem-only rehearsal. It never invokes pg_restore, changes application
// state, decrypts a backup, or accepts production paths.
export async function stageSyntheticRestore(source, copy = copyFile) {
  const parent = await realpath(scratch);
  const parentStat = await lstat(parent);
  if (
    parent !== scratch ||
    !parentStat.isDirectory() ||
    parentStat.mode & 0o077 ||
    parentStat.uid !== process.getuid?.() ||
    typeof source !== "string" ||
    path.dirname(source) !== parent
  )
    throw new Error("RESTORE_SANDBOX_REQUIRED");
  await verifyBackupSet(source);
  const manifest = await readBoundedManifest(source);
  const total =
    manifest.database.bytes +
    manifest.objects.reduce((sum, object) => sum + object.bytes, 0) +
    (manifest.version === 2 ? manifest.inventory.bytes : 0);
  if (!Number.isSafeInteger(total) || total > MAX_REHEARSAL_BYTES)
    throw new Error("RESTORE_REHEARSAL_TOO_LARGE");
  const stage = await mkdtemp(path.join(parent, "restore-synthetic-"));
  try {
    await mkdir(path.join(stage, "objects"), { mode: 0o700 });
    for (const name of [
      "manifest.json",
      "database.dump",
      ...(manifest.version === 2 ? ["inventory.json"] : []),
    ])
      await copy(
        path.join(source, name),
        path.join(stage, name),
        constants.COPYFILE_EXCL,
      );
    for (const object of manifest.objects)
      await copy(
        path.join(source, "objects", object.key),
        path.join(stage, "objects", object.key),
        constants.COPYFILE_EXCL,
      );
    const result = await verifyBackupSet(stage);
    return { stage, ...result };
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
}
