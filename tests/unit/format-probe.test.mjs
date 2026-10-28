import { test, expect } from "vitest";
import { mkdtemp, open, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { probeFileFormat } from "../../apps/api/src/modules/files/format-probe.ts";

async function probe(bytes, format) {
  const dir = await mkdtemp(
    path.join(process.cwd(), ".local", "dental-probe-synthetic-"),
  );
  const name = path.join(dir, "private-object");
  try {
    await writeFile(name, bytes);
    const handle = await open(name, "r");
    try {
      return await probeFileFormat(handle, bytes.length, format);
    } finally {
      await handle.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test("seven supported families have a bounded preliminary content check", async () => {
  const png = Buffer.concat([
    Buffer.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
      0, 0, 0, 1, 8, 2, 0, 0, 0, 0, 0, 0, 0,
    ]),
    Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]),
  ]);
  const stl = Buffer.alloc(134);
  stl.writeUInt32LE(1, 80);
  const samples = [
    ["png", png],
    ["jpg", Buffer.from([255, 216, 255, 224, 0, 0, 255, 217])],
    ["pdf", Buffer.from("%PDF-1.7\n%%EOF\n")],
    [
      "heic",
      Buffer.from([
        0, 0, 0, 16, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0,
      ]),
    ],
    ["stl", stl],
    [
      "ply",
      Buffer.from(
        "ply\nformat ascii 1.0\nelement vertex 1\nend_header\n0 0 0\n",
      ),
    ],
    ["obj", Buffer.from("v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n")],
  ];
  for (const [format, bytes] of samples) {
    expect(await probe(bytes, format)).toBe("candidate");
    expect(await probe(bytes, format === "pdf" ? "png" : "pdf")).toBe(
      "rejected",
    );
  }
});
test("truncation, spoofed headers, impossible STL counts and unknown format are rejected", async () => {
  expect(await probe(Buffer.from("%PDF-1.7\nnot complete"), "pdf")).toBe(
    "rejected",
  );
  expect(await probe(Buffer.from([255, 216, 255, 224]), "jpg")).toBe(
    "rejected",
  );
  const stl = Buffer.alloc(134);
  stl.writeUInt32LE(2, 80);
  expect(await probe(stl, "stl")).toBe("rejected");
  expect(await probe(Buffer.from("hello"), "obj")).toBe("rejected");
  expect(await probe(Buffer.from("hello"), "zip")).toBe("rejected");
});
import { inspectFileStructure } from "../../apps/api/src/modules/files/format-probe.ts";
async function inspect(bytes, format) {
  const dir = await mkdtemp(
    path.join(process.cwd(), ".local", "dental-structure-synthetic-"),
  );
  try {
    const name = path.join(dir, "private-object");
    await writeFile(name, bytes);
    const handle = await open(name, "r");
    try {
      return await inspectFileStructure(handle, bytes.length, format);
    } finally {
      await handle.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
function pngChunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([name, data])) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const check = Buffer.alloc(4);
  check.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, name, data, check]);
}
test("bounded PNG chunk CRC and STL triangle checks reject plausible corruption", async () => {
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", Buffer.from([1, 2, 3])),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  expect(await inspect(png, "png")).toBe("candidate");
  const altered = Buffer.from(png);
  altered[42] ^= 1;
  expect(await inspect(altered, "png")).toBe("rejected");
  const stl = Buffer.alloc(134);
  stl.writeUInt32LE(1, 80);
  for (const [offset, value] of [
    [96, 1],
    [108, 1],
  ])
    stl.writeFloatLE(value, offset);
  expect(await inspect(stl, "stl")).toBe("candidate");
  stl.writeFloatLE(Infinity, 96);
  expect(await inspect(stl, "stl")).toBe("rejected");
  expect(await inspect(Buffer.from("%PDF-1.7\n%%EOF\n"), "pdf")).toBe(
    "unsupported",
  );
});
test("bounded ASCII STL validates facet grammar and finite vertices", async () => {
  const stl = Buffer.from(
    "solid model\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid model\n",
  );
  expect(await probe(stl, "stl")).toBe("candidate");
  expect(await inspect(stl, "stl")).toBe("candidate");
  expect(
    await inspect(
      Buffer.from(stl.toString().replace("vertex 0 1 0", "vertex NaN 1 0")),
      "stl",
    ),
  ).toBe("rejected");
  expect(
    await inspect(
      Buffer.from(stl.toString().replace("endfacet", "endfaket")),
      "stl",
    ),
  ).toBe("rejected");
});
