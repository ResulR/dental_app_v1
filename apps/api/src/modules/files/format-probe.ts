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

// Stronger bounded structural checks for two formats. A candidate is still
// quarantined: neither malware safety nor full decoding is established here.
export async function inspectFileStructure(
  file: FileHandle,
  sizeBytes: number,
  expected: FileFormat,
): Promise<"candidate" | "rejected" | "unsupported"> {
  if ((await probeFileFormat(file, sizeBytes, expected)) !== "candidate")
    return "rejected";
  if (sizeBytes > 16 * 1024 * 1024) return "unsupported";
  if (expected === "stl") {
    const header = await bytesAt(file, 84, 0);
    if (header.length !== 84) return "rejected";
    const faces = header.readUInt32LE(80);
    if (faces > 100_000) return "unsupported";
    if (faces < 1 || 84 + faces * 50 !== sizeBytes) return "rejected";
    for (let index = 0; index < faces; index++) {
      const face = await bytesAt(file, 50, 84 + index * 50);
      if (face.length !== 50 || face.readUInt16LE(48) !== 0) return "rejected";
      for (let coordinate = 0; coordinate < 12; coordinate++)
        if (!Number.isFinite(face.readFloatLE(coordinate * 4)))
          return "rejected";
    }
    return "candidate";
  }
  if (expected !== "png") return "unsupported";
  let offset = 8,
    chunks = 0,
    image = false,
    data = false,
    ended = false;
  while (offset + 12 <= sizeBytes && ++chunks <= 512) {
    const header = await bytesAt(file, 8, offset);
    if (header.length !== 8) return "rejected";
    const length = header.readUInt32BE(0);
    const type = header.subarray(4, 8).toString("ascii");
    if (
      length > 16 * 1024 * 1024 ||
      !/^[A-Za-z]{4}$/.test(type) ||
      offset + 12 + length > sizeBytes
    )
      return "rejected";
    if (!image && (type !== "IHDR" || length !== 13)) return "rejected";
    if (image && type === "IHDR") return "rejected";
    if (
      !["IHDR", "PLTE", "IDAT", "IEND"].includes(type) &&
      type[0] === type[0]!.toUpperCase()
    )
      return "rejected";
    const crc = await bytesAt(file, 4, offset + 8 + length);
    if (crc.length !== 4) return "rejected";
    let checksum = 0xffffffff;
    const buffer = Buffer.alloc(64 * 1024);
    for (let cursor = offset + 4; cursor < offset + 8 + length;) {
      const { bytesRead } = await file.read(
        buffer,
        0,
        Math.min(buffer.length, offset + 8 + length - cursor),
        cursor,
      );
      if (!bytesRead) return "rejected";
      // Incremental CRC avoids retaining a large IDAT chunk.
      for (let i = 0; i < bytesRead; i++) {
        checksum ^= buffer[i]!;
        for (let bit = 0; bit < 8; bit++)
          checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0);
      }
      cursor += bytesRead;
    }
    if ((checksum ^ 0xffffffff) >>> 0 !== crc.readUInt32BE(0))
      return "rejected";
    if (type === "IHDR") {
      const ihdr = await bytesAt(file, 13, offset + 8);
      const width = ihdr.readUInt32BE(0),
        height = ihdr.readUInt32BE(4);
      if (
        !width ||
        !height ||
        width > 10000 ||
        height > 10000 ||
        width * height > 50_000_000 ||
        ihdr[10] !== 0 ||
        ihdr[11] !== 0 ||
        ihdr[12] !== 0 ||
        !(
          {
            0: [1, 2, 4, 8, 16],
            2: [8, 16],
            3: [1, 2, 4, 8],
            4: [8, 16],
            6: [8, 16],
          } as Record<number, number[]>
        )[ihdr[9]!]?.includes(ihdr[8]!)
      )
        return "rejected";
      image = true;
    }
    if (type === "IDAT") {
      if (!length) return "rejected";
      data = true;
    }
    if (type === "IEND") {
      if (length || !data || offset + 12 !== sizeBytes) return "rejected";
      ended = true;
      break;
    }
    offset += 12 + length;
  }
  if (chunks > 512) return "unsupported";
  return ended && image ? "candidate" : "rejected";
}
