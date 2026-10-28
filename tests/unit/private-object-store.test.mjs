import { test, expect } from "vitest";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  readdir,
  lstat,
  symlink,
  rm,
  rmdir,
  chmod,
} from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createPrivateObjectStore } from "../../apps/api/src/modules/files/private-object-store.ts";

async function fixture(run) {
  const root = await mkdtemp(
    path.join(process.cwd(), ".local", "dental-private-synthetic-"),
  );
  try {
    await chmod(root, 0o700);
    await mkdir(path.join(root, "quarantine"), { mode: 0o700 });
    await mkdir(path.join(root, "objects"), { mode: 0o700 });
    return await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test("sealed object uses opaque key outside public roots; writer owns bytes and never overwrites", async () =>
  fixture(async (root) => {
    const store = await createPrivateObjectStore(root, [
      path.join(root, "public"),
    ]);
    const writer = await store.create();
    const bytes = Buffer.from("synthetic-only");
    await writer.write(bytes);
    bytes.fill(0);
    const sealed = await writer.seal();
    expect(sealed.objectKey).toMatch(/^[0-9a-f]{64}$/);
    expect(sealed.sizeBytes).toBe(14);
    expect(sealed.sha256).toBe(
      createHash("sha256").update("synthetic-only").digest("hex"),
    );
    expect(
      await readFile(path.join(root, "objects", sealed.objectKey), "utf8"),
    ).toBe("synthetic-only");
    expect(
      (await lstat(path.join(root, "objects", sealed.objectKey))).mode & 0o777,
    ).toBe(0o400);
    expect(await readdir(path.join(root, "quarantine"))).toEqual([]);
    await expect(writer.write(Buffer.from("x"))).rejects.toThrow();
    await expect(writer.abandon()).rejects.toThrow("PRIVATE_STORAGE_SEALED");
  }));
test("aborted incomplete object stays private then is removed only by its writer", async () =>
  fixture(async (root) => {
    const writer = await (
      await createPrivateObjectStore(root, [path.join(root, "public")])
    ).create();
    await writer.write(Buffer.from("unfinished"));
    expect(await readdir(path.join(root, "quarantine"))).toHaveLength(1);
    await writer.abandon();
    expect(await readdir(path.join(root, "quarantine"))).toEqual([]);
    expect(await readdir(path.join(root, "objects"))).toEqual([]);
    await expect(writer.seal()).rejects.toThrow();
  }));
test("public root, permissive mode and symlink directories fail closed", async () =>
  fixture(async (root) => {
    await expect(createPrivateObjectStore(root, [root])).rejects.toThrow(
      "PRIVATE_STORAGE_UNSAFE",
    );
    await expect(createPrivateObjectStore(root, [])).rejects.toThrow(
      "PRIVATE_STORAGE_POLICY_REQUIRED",
    );
    const quarantine = path.join(root, "quarantine");
    await rmdir(quarantine);
    await symlink(path.join(root, "objects"), quarantine);
    await expect(
      createPrivateObjectStore(root, [path.join(root, "public")]),
    ).rejects.toThrow("PRIVATE_STORAGE_UNSAFE");
    await rm(quarantine);
    await mkdir(quarantine, { mode: 0o700 });
    await chmod(quarantine, 0o755);
    await expect(
      createPrivateObjectStore(root, [path.join(root, "public")]),
    ).rejects.toThrow("PRIVATE_STORAGE_UNSAFE");
  }));
test("empty and oversized chunks cannot be sealed or written", async () =>
  fixture(async (root) => {
    const writer = await (
      await createPrivateObjectStore(root, [path.join(root, "public")])
    ).create();
    await expect(writer.write(new Uint8Array())).rejects.toThrow(
      "PRIVATE_STORAGE_WRITE_REJECTED",
    );
    await expect(writer.seal()).rejects.toThrow();
    await writer.abandon();
  }));
test("seal checks persisted bytes and retains a changed quarantine object for explicit failure cleanup", async () =>
  fixture(async (root) => {
    const writer = await (
      await createPrivateObjectStore(root, [path.join(root, "public")])
    ).create();
    await writer.write(Buffer.from("synthetic"));
    const [name] = await readdir(path.join(root, "quarantine"));
    await writeFile(path.join(root, "quarantine", name), "different");
    await expect(writer.seal()).rejects.toThrow("PRIVATE_STORAGE_INTEGRITY");
    expect(await readdir(path.join(root, "objects"))).toEqual([]);
    await writer.abandon();
    expect(await readdir(path.join(root, "quarantine"))).toEqual([]);
  }));
