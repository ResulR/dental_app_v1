import type { FileHandle } from "node:fs/promises";
import { assertFileSize } from "./transfer-limits.js";

export type FileFormat = "stl" | "ply" | "obj" | "jpg" | "png" | "heic" | "pdf";
const supported = new Set<FileFormat>([
  "stl",
  "ply",
  "obj",
  "jpg",
  "png",
  "heic",
  "pdf",
]);
const ascii = (bytes: Buffer) => bytes.toString("ascii");
async function bytesAt(file: FileHandle, length: number, position: number) {
  const buffer = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const { bytesRead } = await file.read(
      buffer,
      offset,
      length - offset,
      position + offset,
    );
    if (!bytesRead) break;
    offset += bytesRead;
  }
  return buffer.subarray(0, offset);
}
// Bounded rejection filter only. A matching result is NOT a full parser verdict,
// malware scan, publication decision or authorization to download.
export async function probeFileFormat(
  file: FileHandle,
  sizeBytes: number,
  expected: FileFormat,
): Promise<"candidate" | "rejected"> {
  assertFileSize(sizeBytes);
  if (!supported.has(expected)) return "rejected";
  const head = await bytesAt(file, Math.min(sizeBytes, 4096), 0);
  const tail = await bytesAt(
    file,
    Math.min(sizeBytes, 4096),
    Math.max(0, sizeBytes - 4096),
  );
  if (
    head.length !== Math.min(sizeBytes, 4096) ||
    tail.length !== Math.min(sizeBytes, 4096)
  )
    return "rejected";
  const text = ascii(head);
  switch (expected) {
    case "png":
      return head.length >= 33 &&
        head
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
        head.readUInt32BE(8) === 13 &&
        ascii(head.subarray(12, 16)) === "IHDR" &&
        head.readUInt32BE(16) > 0 &&
        head.readUInt32BE(20) > 0 &&
        tail
          .subarray(-12)
          .equals(Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]))
        ? "candidate"
        : "rejected";
    case "jpg":
      return sizeBytes >= 4 &&
        head[0] === 0xff &&
        head[1] === 0xd8 &&
        head[2] === 0xff &&
        tail.subarray(-2).equals(Buffer.from([0xff, 0xd9]))
        ? "candidate"
        : "rejected";
    case "pdf":
      return text.startsWith("%PDF-") &&
        /%%EOF\s*$/.test(tail.toString("latin1"))
        ? "candidate"
        : "rejected";
    case "heic":
      return head.length >= 16 &&
        head.readUInt32BE(0) >= 16 &&
        ascii(head.subarray(4, 8)) === "ftyp" &&
        ["heic", "heix", "hevc", "hevx"].includes(
          ascii(head.subarray(8, 12)),
        ) &&
        head.readUInt32BE(0) <= sizeBytes
        ? "candidate"
        : "rejected";
    case "stl": {
      if (sizeBytes < 84) return "rejected";
      const faces = head.readUInt32LE(80);
      return 84 + faces * 50 === sizeBytes && faces > 0
        ? "candidate"
        : "rejected";
    }
    case "ply":
      return /^ply\r?\nformat (ascii|binary_little_endian|binary_big_endian) 1\.0\r?\n/.test(
        text,
      ) && text.includes("\nend_header\n")
        ? "candidate"
        : "rejected";
    case "obj":
      return /^(?:#[^\r\n]*\r?\n|\s)*(?:v |o |g )/.test(text) &&
        /\nv [^\r\n]+/.test("\n" + text) &&
        /\nf [^\r\n]+/.test("\n" + tail.toString("utf8"))
        ? "candidate"
        : "rejected";
  }
}
