import { createHash, randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, open, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import { createPrivateObjectStore } from "./private-object-store.js";
import { boundedUploadBytes, FILE_MAX_BYTES } from "./transfer-limits.js";

const uploadPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hashPattern = /^[0-9a-f]{64}$/;
type Part = { index: number; sizeBytes: number; sha256: string };
function partName(uploadId: string, index: number) {
  if (
    !uploadPattern.test(uploadId) ||
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index > 2_147_483_647
  )
    throw new Error("PRIVATE_CHUNK_IDENTIFIER");
  return uploadId.toLowerCase() + "." + index;
}
async function digestFile(filePath: string, expectedSize: number) {
  const handle = await open(
    filePath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size !== expectedSize)
      throw new Error("PRIVATE_CHUNK_INTEGRITY");
    const hash = createHash("sha256");
    const buffer = Buffer.alloc(64 * 1024);
    for (let offset = 0; offset < expectedSize;) {
      const { bytesRead } = await handle.read(
        buffer,
        0,
        Math.min(buffer.length, expectedSize - offset),
        offset,
      );
      if (!bytesRead) throw new Error("PRIVATE_CHUNK_INTEGRITY");
      hash.update(buffer.subarray(0, bytesRead));
      offset += bytesRead;
    }
    return hash.digest("hex");
  } finally {
    await handle.close();
  }
}
// Storage port only: session authority, capacity reservation, DB chunk receipts,
// expiry and publication remain mandatory in the caller. No HTTP route.
export async function createPrivateChunkStore(
  root: string,
  excludedRoots: readonly string[],
) {
  const objects = await createPrivateObjectStore(root, excludedRoots);
  const directory = path.join(root, "chunks");
  const stat = await lstat(directory);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o077) !== 0 ||
    stat.uid !== process.getuid?.() ||
    (await realpath(directory)) !== directory
  )
    throw new Error("PRIVATE_STORAGE_UNSAFE");
  return {
    verifyObject: objects.verifySealed,
    // Only call after a durable, terminal cleanup claim. Never delete objects.
    async discard(uploadId: string, count: number) {
      if (!Number.isSafeInteger(count) || count < 1 || count > 10000)
        throw new Error("PRIVATE_CHUNK_BUDGET");
      for (let index = 0; index < count; index++) {
        const name = path.join(directory, partName(uploadId, index));
        const current = await lstat(name).catch(
          (error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") return null;
            throw error;
          },
        );
        if (!current) continue;
        if (!current.isFile() || current.isSymbolicLink())
          throw new Error("PRIVATE_CHUNK_CONFLICT");
        // The private directory is owned by this process identity and mode 0700.
        // Recheck the inode on an O_NOFOLLOW descriptor before removal.
        const handle = await open(
          name,
          constants.O_RDONLY | constants.O_NOFOLLOW,
        );
        try {
          const stat = await handle.stat();
          if (!stat.isFile() || stat.ino !== current.ino)
            throw new Error("PRIVATE_CHUNK_CONFLICT");
          await unlink(name);
        } finally {
          await handle.close();
        }
      }
      const dir = await open(
        directory,
        constants.O_RDONLY | constants.O_DIRECTORY,
      );
      try {
        await dir.sync();
      } finally {
        await dir.close();
      }
    },
    async put(
      uploadId: string,
      part: Part,
      source: AsyncIterable<Uint8Array>,
      signal: AbortSignal,
      maxChunkBytes: number,
    ) {
      const name = partName(uploadId, part.index);
      if (
        !Number.isSafeInteger(part.sizeBytes) ||
        part.sizeBytes <= 0 ||
        part.sizeBytes > FILE_MAX_BYTES ||
        !hashPattern.test(part.sha256) ||
        !Number.isSafeInteger(maxChunkBytes) ||
        maxChunkBytes <= 0 ||
        maxChunkBytes > FILE_MAX_BYTES
      )
        throw new Error("PRIVATE_CHUNK_INVALID");
      signal.throwIfAborted();
      const final = path.join(directory, name);
      // A lost response is not proof of a DB receipt: the caller must reconcile
      // the SQL row before returning "already acknowledged" to the client.
      const existing = await lstat(final).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return null;
          throw error;
        },
      );
      if (existing) {
        if (
          !existing.isFile() ||
          existing.isSymbolicLink() ||
          (await digestFile(final, part.sizeBytes)) !== part.sha256
        )
          throw new Error("PRIVATE_CHUNK_CONFLICT");
        return { kind: "existing" as const };
      }
      const temporary = path.join(
        directory,
        "." + randomBytes(32).toString("hex"),
      );
      const writer = await open(
        temporary,
        constants.O_CREAT |
          constants.O_EXCL |
          constants.O_WRONLY |
          constants.O_NOFOLLOW,
        0o600,
      );
      const inode = (await writer.stat()).ino;
      let sealed = false;
      try {
        const hash = createHash("sha256");
        for await (const chunk of boundedUploadBytes(
          source,
          part.sizeBytes,
          signal,
        )) {
          if (chunk.byteLength > maxChunkBytes)
            throw new Error("PRIVATE_CHUNK_BUDGET");
          const bytes = Buffer.from(chunk);
          let offset = 0;
          while (offset < bytes.length) {
            const { bytesWritten } = await writer.write(
              bytes,
              offset,
              bytes.length - offset,
            );
            if (!bytesWritten) throw new Error("PRIVATE_CHUNK_SHORT_WRITE");
            offset += bytesWritten;
          }
          hash.update(bytes);
        }
        if (hash.digest("hex") !== part.sha256)
          throw new Error("PRIVATE_CHUNK_INTEGRITY");
        await writer.sync();
        await writer.chmod(0o400);
        await writer.sync();
        await writer.close();
        if ((await digestFile(temporary, part.sizeBytes)) !== part.sha256)
          throw new Error("PRIVATE_CHUNK_INTEGRITY");
        await link(temporary, final);
        sealed = true;
        return { kind: "stored" as const };
      } finally {
        await writer.close().catch(() => {});
        const current = await lstat(temporary).catch(
          (error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") return null;
            throw error;
          },
        );
        if (
          current?.isFile() &&
          !current.isSymbolicLink() &&
          current.ino === inode
        )
          await unlink(temporary);
        // The linked final is retained on uncertain failure for durable reconciliation.
        if (sealed) {
          const dir = await open(
            directory,
            constants.O_RDONLY | constants.O_DIRECTORY,
          );
          try {
            await dir.sync();
          } finally {
            await dir.close();
          }
        }
      }
    },
    async assemble(
      uploadId: string,
      declaredSize: number,
      chunkSize: number,
      maxSegments: number,
      parts: readonly Part[],
      expectedSha256: string,
      previous?: { objectKey: string; sizeBytes: number; sha256: string },
    ) {
      partName(uploadId, 0);
      if (
        !Number.isSafeInteger(declaredSize) ||
        declaredSize <= 0 ||
        declaredSize > FILE_MAX_BYTES ||
        !hashPattern.test(expectedSha256) ||
        !Number.isSafeInteger(chunkSize) ||
        chunkSize <= 0 ||
        chunkSize > FILE_MAX_BYTES ||
        !Number.isSafeInteger(maxSegments) ||
        maxSegments <= 0 ||
        !parts.length ||
        parts.length > maxSegments
      )
        throw new Error("PRIVATE_ASSEMBLY_INVALID");
      let total = 0;
      for (let index = 0; index < parts.length; index++) {
        const part = parts[index]!;
        if (
          part.index !== index ||
          part.sizeBytes !==
            Math.min(chunkSize, declaredSize - index * chunkSize) ||
          !Number.isSafeInteger(part.sizeBytes) ||
          part.sizeBytes <= 0 ||
          !hashPattern.test(part.sha256)
        )
          throw new Error("PRIVATE_ASSEMBLY_INVALID");
        total += part.sizeBytes;
        if (total > declaredSize) throw new Error("PRIVATE_ASSEMBLY_INVALID");
      }
      if (total !== declaredSize)
        throw new Error("PRIVATE_ASSEMBLY_INCOMPLETE");
      if (previous) {
        if (
          previous.sizeBytes !== declaredSize ||
          previous.sha256 !== expectedSha256
        )
          throw new Error("PRIVATE_ASSEMBLY_CONFLICT");
        await objects.verifySealed(
          previous.objectKey,
          declaredSize,
          expectedSha256,
        );
        return { ...previous, kind: "existing" as const };
      }
      const target = await objects.create();
      try {
        for (const part of parts) {
          const name = path.join(directory, partName(uploadId, part.index));
          const handle = await open(
            name,
            constants.O_RDONLY | constants.O_NOFOLLOW,
          );
          try {
            const stat = await handle.stat();
            if (!stat.isFile() || stat.size !== part.sizeBytes)
              throw new Error("PRIVATE_CHUNK_INTEGRITY");
            const hash = createHash("sha256");
            const buffer = Buffer.alloc(64 * 1024);
            for (let offset = 0; offset < part.sizeBytes;) {
              const { bytesRead } = await handle.read(
                buffer,
                0,
                Math.min(buffer.length, part.sizeBytes - offset),
                offset,
              );
              if (!bytesRead) throw new Error("PRIVATE_CHUNK_INTEGRITY");
              const slice = buffer.subarray(0, bytesRead);
              hash.update(slice);
              await target.write(slice);
              offset += bytesRead;
            }
            if (hash.digest("hex") !== part.sha256)
              throw new Error("PRIVATE_CHUNK_INTEGRITY");
          } finally {
            await handle.close();
          }
        }
        const sealed = await target.seal();
        if (
          sealed.sizeBytes !== declaredSize ||
          sealed.sha256 !== expectedSha256
        )
          throw new Error("PRIVATE_ASSEMBLY_INTEGRITY");
        // A mismatch after seal is retained; never delete a potentially referenced object.
        return { ...sealed, kind: "assembled" as const };
      } catch (error) {
        await target.abandon().catch(() => {});
        throw error;
      }
    },
  };
}
