import { test, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import { stageSyntheticRestore } from "../../scripts/stage-synthetic-restore.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const key = "c".repeat(64);
async function sourceSet() {
  const parent = path.join(process.cwd(), ".local");
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const root = await mkdtemp(path.join(parent, "synthetic-source-"));
  await mkdir(path.join(root, "objects"), { mode: 0o700 });
  const database = Buffer.from("synthetic database only");
  const object = Buffer.from("synthetic object only");
  const manifest = {
    version: 1,
    snapshotAt: "2026-11-12T10:00:00Z",
    database: { bytes: database.length, sha256: digest(database) },
    objects: [{ key, bytes: object.length, sha256: digest(object) }],
  };
  await writeFile(path.join(root, "manifest.json"), JSON.stringify(manifest));
  await writeFile(path.join(root, "database.dump"), database);
  await writeFile(path.join(root, "objects", key), object);
  return { root, parent };
}

test("stages a verified synthetic DB and object set within private project scratch", async () => {
  const { root } = await sourceSet();
  let stage;
  try {
    const result = await stageSyntheticRestore(root);
    stage = result.stage;
    expect(result.objectCount).toBe(1);
    expect(path.dirname(stage)).toBe(path.join(process.cwd(), ".local"));
    expect(await readFile(path.join(stage, "objects", key), "utf8")).toBe(
      "synthetic object only",
    );
  } finally {
    if (stage) await rm(stage, { recursive: true });
    await rm(root, { recursive: true });
  }
});

test("fails closed on a partial copy, cleans only its own stage and permits explicit retry", async () => {
  const { root, parent } = await sourceSet();
  const before = new Set(await readdir(parent));
  let stage;
  try {
    await expect(
      stageSyntheticRestore(root, async (from, to, flags) => {
        if (from.endsWith(key)) throw new Error("INTERRUPTED_COPY");
        return copyFile(from, to, flags);
      }),
    ).rejects.toThrow("INTERRUPTED_COPY");
    expect(new Set(await readdir(parent))).toEqual(before);
    stage = (await stageSyntheticRestore(root)).stage;
    expect(await readFile(path.join(stage, "database.dump"), "utf8")).toBe(
      "synthetic database only",
    );
  } finally {
    if (stage) await rm(stage, { recursive: true });
    await rm(root, { recursive: true });
  }
});

test("rejects altered data and an out-of-project source without staging", async () => {
  const { root, parent } = await sourceSet();
  try {
    await writeFile(path.join(root, "objects", key), "modified");
    const before = new Set(await readdir(parent));
    await expect(stageSyntheticRestore(root)).rejects.toThrow();
    expect(new Set(await readdir(parent))).toEqual(before);
    await expect(
      stageSyntheticRestore("/tmp/unapproved-source"),
    ).rejects.toThrow("RESTORE_SANDBOX_REQUIRED");
  } finally {
    await rm(root, { recursive: true });
  }
});
