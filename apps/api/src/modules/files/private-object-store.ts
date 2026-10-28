import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath, unlink, link } from "node:fs/promises";
import path from "node:path";
import { assertFileSize, FILE_MAX_BYTES } from "./transfer-limits.js";

function within(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith(".." + path.sep) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}
async function privateDirectory(directory: string) {
  const stat = await lstat(directory);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o077) !== 0 ||
    stat.uid !== process.getuid?.()
  )
    throw new Error("PRIVATE_STORAGE_UNSAFE");
  return realpath(directory);
}
// The caller must provision root/quarantine/objects and provide every public
// directory boundary. This storage primitive has no route, scan or capacity policy.
export async function createPrivateObjectStore(
  root: string,
  excludedRoots: readonly string[],
) {
  if (
    !path.isAbsolute(root) ||
    !excludedRoots.length ||
    excludedRoots.some((p) => !path.isAbsolute(p))
  )
    throw new Error("PRIVATE_STORAGE_POLICY_REQUIRED");
  const resolved = await privateDirectory(root);
  if (resolved !== path.resolve(root))
    throw new Error("PRIVATE_STORAGE_UNSAFE");
  const quarantine = await privateDirectory(path.join(resolved, "quarantine"));
  const objects = await privateDirectory(path.join(resolved, "objects"));
  if (
    quarantine !== path.join(resolved, "quarantine") ||
    objects !== path.join(resolved, "objects") ||
    excludedRoots.some((publicRoot) =>
      within(path.resolve(publicRoot), resolved),
    )
  )
    throw new Error("PRIVATE_STORAGE_UNSAFE");
  return {
    async create() {
      const objectKey = randomUUID();
      const temporary = path.join(quarantine, objectKey);
      const final = path.join(objects, objectKey);
      const writer = await open(
        temporary,
        constants.O_CREAT |
          constants.O_EXCL |
          constants.O_WRONLY |
          constants.O_NOFOLLOW,
        0o600,
      );
      const inode = (await writer.stat()).ino;
      const hash = createHash("sha256");
      let length = 0,
        closed = false,
        sealed = false;
      async function close() {
        if (!closed) {
          closed = true;
          await writer.close();
        }
      }
      // Never remove an object if its path has been replaced by another inode.
      async function discardTemporary() {
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
      }
      return {
        async write(bytes: Uint8Array) {
          if (
            closed ||
            sealed ||
            !(bytes instanceof Uint8Array) ||
            !bytes.byteLength ||
            bytes.byteLength > FILE_MAX_BYTES - length
          )
            throw new Error("PRIVATE_STORAGE_WRITE_REJECTED");
          const owned = Buffer.from(bytes);
          let offset = 0;
          while (offset < owned.length) {
            const result = await writer.write(
              owned,
              offset,
              owned.length - offset,
            );
            if (!result.bytesWritten)
              throw new Error("PRIVATE_STORAGE_SHORT_WRITE");
            offset += result.bytesWritten;
          }
          hash.update(owned);
          length += owned.length;
        },
        async seal() {
          if (closed || sealed)
            throw new Error("PRIVATE_STORAGE_SEAL_REJECTED");
          assertFileSize(length);
          await writer.sync();
          await writer.chmod(0o400);
          await writer.sync();
          await close();
          const expectedHash = hash.digest("hex");
          const reader = await open(
            temporary,
            constants.O_RDONLY | constants.O_NOFOLLOW,
          );
          try {
            const stat = await reader.stat();
            if (stat.ino !== inode || stat.size !== length || !stat.isFile())
              throw new Error("PRIVATE_STORAGE_INTEGRITY");
            const storedHash = createHash("sha256");
            const buffer = Buffer.alloc(64 * 1024);
            let offset = 0;
            while (offset < length) {
              const { bytesRead } = await reader.read(
                buffer,
                0,
                Math.min(buffer.length, length - offset),
                offset,
              );
              if (!bytesRead) throw new Error("PRIVATE_STORAGE_INTEGRITY");
              storedHash.update(buffer.subarray(0, bytesRead));
              offset += bytesRead;
            }
            if (storedHash.digest("hex") !== expectedHash)
              throw new Error("PRIVATE_STORAGE_INTEGRITY");
          } finally {
            await reader.close();
          }
          // link is exclusive and never replaces an existing sealed object.
          await link(temporary, final);
          sealed = true;
          // Failure to remove the quarantine link leaves evidence for reconciliation.
          await unlink(temporary);
          const dir = await open(
            objects,
            constants.O_RDONLY | constants.O_DIRECTORY,
          );
          try {
            await dir.sync();
          } finally {
            await dir.close();
          }
          return { objectKey, sizeBytes: length, sha256: expectedHash };
        },
        async abandon() {
          if (sealed) throw new Error("PRIVATE_STORAGE_SEALED");
          await close();
          await discardTemporary();
        },
      };
    },
  };
}
