import { test, expect } from "vitest";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { verifyBackupSet } from "../../scripts/verify-backup-set.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const key = "a".repeat(32);
async function fixture() {
  const parent = path.join(process.cwd(), ".local");
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const root = await mkdtemp(path.join(parent, "backup-check-"));
  await mkdir(path.join(root, "objects"), { mode: 0o700 });
  const database = Buffer.from("synthetic database dump");
  const object = Buffer.from("synthetic private object");
  const manifest = {
    version: 1,
    snapshotAt: "2026-11-12T10:00:00Z",
    database: { bytes: database.length, sha256: digest(database) },
    objects: [{ key, bytes: object.length, sha256: digest(object) }],
  };
  await writeFile(path.join(root, "database.dump"), database);
  await writeFile(path.join(root, "objects", key), object);
  await writeFile(path.join(root, "manifest.json"), JSON.stringify(manifest));
  return { root, manifest };
}

test("verifies a complete synthetic set without changing it", async () => {
  const { root } = await fixture();
  try {
    expect(await verifyBackupSet(root)).toEqual({
      snapshotAt: "2026-11-12T10:00:00Z",
      objectCount: 1,
    });
  } finally {
    await rm(root, { recursive: true });
  }
});

test("rejects absent, tampered, duplicate and escaping objects", async () => {
  const { root, manifest } = await fixture();
  try {
    await writeFile(path.join(root, "objects", key), "altered");
    await expect(verifyBackupSet(root)).rejects.toThrow("BACKUP_SIZE_MISMATCH");
    await rm(path.join(root, "objects", key));
    await expect(verifyBackupSet(root)).rejects.toThrow();
    manifest.objects[0].key = "../database.dump";
    await writeFile(path.join(root, "manifest.json"), JSON.stringify(manifest));
    await expect(verifyBackupSet(root)).rejects.toThrow(
      "BACKUP_MANIFEST_INVALID",
    );
    manifest.objects[0].key = key;
    manifest.objects.push({ ...manifest.objects[0] });
    await writeFile(path.join(root, "manifest.json"), JSON.stringify(manifest));
    await expect(verifyBackupSet(root)).rejects.toThrow(
      "BACKUP_MANIFEST_INVALID",
    );
  } finally {
    await rm(root, { recursive: true });
  }
});

test("rejects same-size corruption, symlinked files and symlinked root", async () => {
  const { root } = await fixture();
  const link = root + "-link";
  try {
    await writeFile(
      path.join(root, "database.dump"),
      "SYNTHETIC database dump",
    );
    await expect(verifyBackupSet(root)).rejects.toThrow("BACKUP_HASH_MISMATCH");
    await rm(path.join(root, "database.dump"));
    await symlink(
      path.join(root, "objects", key),
      path.join(root, "database.dump"),
    );
    await expect(verifyBackupSet(root)).rejects.toThrow();
    await symlink(root, link);
    await expect(verifyBackupSet(link)).rejects.toThrow("BACKUP_ROOT_INVALID");
  } finally {
    await rm(link);
    await rm(root, { recursive: true });
  }
});

test("refuses incomplete or oversized manifests", async () => {
  const { root, manifest } = await fixture();
  try {
    delete manifest.database;
    await writeFile(path.join(root, "manifest.json"), JSON.stringify(manifest));
    await expect(verifyBackupSet(root)).rejects.toThrow(
      "BACKUP_MANIFEST_INVALID",
    );
    await writeFile(
      path.join(root, "manifest.json"),
      "x".repeat(16 * 1024 * 1024 + 1),
    );
    await expect(verifyBackupSet(root)).rejects.toThrow(
      "BACKUP_MANIFEST_INVALID",
    );
  } finally {
    await rm(root, { recursive: true });
  }
});
