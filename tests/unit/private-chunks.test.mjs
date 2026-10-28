import { test, expect } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, chmod, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { createPrivateChunkStore } from "../../apps/api/src/modules/files/private-chunks.ts";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const stream = async function* (bytes) {
  yield bytes;
};
async function fixture(run) {
  const root = await mkdtemp(
    path.join(process.cwd(), ".local", "dental-chunks-synthetic-"),
  );
  try {
    await chmod(root, 0o700);
    for (const name of ["quarantine", "objects", "chunks"])
      await mkdir(path.join(root, name), { mode: 0o700 });
    return await run(
      root,
      await createPrivateChunkStore(root, [path.join(root, "public")]),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test("stores bounded chunks, recognizes exact retry without consuming source and assembles in order", async () =>
  fixture(async (root, store) => {
    const uploadId = randomUUID(),
      a = Buffer.from("abc"),
      b = Buffer.from("def");
    const signal = new globalThis.AbortController().signal;
    expect(
      await store.put(
        uploadId,
        { index: 1, sizeBytes: 3, sha256: hash(b) },
        stream(b),
        signal,
        3,
      ),
    ).toEqual({ kind: "stored" });
    expect(
      await store.put(
        uploadId,
        { index: 0, sizeBytes: 3, sha256: hash(a) },
        stream(a),
        signal,
        3,
      ),
    ).toEqual({ kind: "stored" });
    const never = {
      [Symbol.asyncIterator]() {
        throw new Error("source consumed");
      },
    };
    expect(
      await store.put(
        uploadId,
        { index: 0, sizeBytes: 3, sha256: hash(a) },
        never,
        signal,
        3,
      ),
    ).toEqual({ kind: "existing" });
    const object = await store.assemble(
      uploadId,
      6,
      3,
      2,
      [
        { index: 0, sizeBytes: 3, sha256: hash(a) },
        { index: 1, sizeBytes: 3, sha256: hash(b) },
      ],
      hash("abcdef"),
    );
    expect(object.objectKey).toMatch(/^[0-9a-f]{64}$/);
    expect(
      await readFile(path.join(root, "objects", object.objectKey), "utf8"),
    ).toBe("abcdef");
    const retry = await store.assemble(
      uploadId,
      6,
      3,
      2,
      [
        { index: 0, sizeBytes: 3, sha256: hash(a) },
        { index: 1, sizeBytes: 3, sha256: hash(b) },
      ],
      hash("abcdef"),
      object,
    );
    expect(retry).toMatchObject({
      kind: "existing",
      objectKey: object.objectKey,
    });
    expect(await readdir(path.join(root, "objects"))).toEqual([
      object.objectKey,
    ]);
    await expect(
      store.assemble(
        uploadId,
        6,
        3,
        2,
        [
          { index: 0, sizeBytes: 3, sha256: hash(a) },
          { index: 1, sizeBytes: 3, sha256: hash(b) },
        ],
        hash("abcdef"),
        { ...object, sha256: hash("wrong") },
      ),
    ).rejects.toThrow("PRIVATE_ASSEMBLY_CONFLICT");
    expect(await readdir(path.join(root, "quarantine"))).toEqual([]);
  }));
test("conflicting retry, invalid hash, incomplete and interrupted chunk cannot publish", async () =>
  fixture(async (root, store) => {
    const uploadId = randomUUID(),
      signal = new globalThis.AbortController().signal,
      bytes = Buffer.from("abc");
    const part = { index: 0, sizeBytes: 3, sha256: hash(bytes) };
    await store.put(uploadId, part, stream(bytes), signal, 3);
    await expect(
      store.put(
        uploadId,
        { ...part, sha256: hash("xxx") },
        stream(bytes),
        signal,
        3,
      ),
    ).rejects.toThrow("PRIVATE_CHUNK_CONFLICT");
    await expect(
      store.put(
        uploadId,
        { index: 1, sizeBytes: 3, sha256: hash("wrong") },
        stream(bytes),
        signal,
        3,
      ),
    ).rejects.toThrow("PRIVATE_CHUNK_INTEGRITY");
    await expect(
      store.put(
        uploadId,
        { index: 1, sizeBytes: 4, sha256: hash("abcd") },
        stream(bytes),
        signal,
        3,
      ),
    ).rejects.toThrow();
    await expect(
      store.assemble(uploadId, 6, 3, 2, [part], hash("abcdef")),
    ).rejects.toThrow("PRIVATE_ASSEMBLY_INCOMPLETE");
    await expect(
      store.assemble(
        uploadId,
        6,
        3,
        2,
        [part, { ...part, index: 1 }],
        hash("abcdef"),
      ),
    ).rejects.toThrow();
    expect(await readdir(path.join(root, "objects"))).toEqual([]);
    expect(await readdir(path.join(root, "chunks"))).toEqual([
      uploadId.toLowerCase() + ".0",
    ]);
  }));
test("untrusted identifiers, symlink chunk directory and cancelled source are rejected", async () =>
  fixture(async (root, store) => {
    const signal = new globalThis.AbortController(),
      bytes = Buffer.from("abc");
    signal.abort();
    await expect(
      store.put(
        "../etc",
        { index: 0, sizeBytes: 3, sha256: hash(bytes) },
        stream(bytes),
        signal.signal,
        3,
      ),
    ).rejects.toThrow();
    await expect(
      store.put(
        randomUUID(),
        { index: 0, sizeBytes: 3, sha256: hash(bytes) },
        stream(bytes),
        signal.signal,
        3,
      ),
    ).rejects.toThrow();
    expect(await readdir(path.join(root, "chunks"))).toEqual([]);
  }));
