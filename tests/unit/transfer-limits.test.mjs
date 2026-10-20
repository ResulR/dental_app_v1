import { test, expect } from "vitest";
import {
  assertFileSize,
  assertAttachmentLimits,
  boundedUploadBytes,
  FILE_MAX_BYTES,
  BATCH_MAX_BYTES,
} from "../../apps/api/dist/modules/files/index.js";
const files = (count) =>
  Array.from({ length: count }, (_, i) => ({
    id: String(i),
    sizeBytes: FILE_MAX_BYTES,
  }));
test("decimal exact file boundary and invalid numeric declarations fail closed", () => {
  expect(FILE_MAX_BYTES).toBe(200000000);
  expect(BATCH_MAX_BYTES).toBe(1000000000);
  expect(() => assertFileSize(FILE_MAX_BYTES)).not.toThrow();
  for (const n of [0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])
    expect(() => assertFileSize(n)).toThrow("invalid_size");
  expect(() => assertFileSize(FILE_MAX_BYTES + 1)).toThrow("file_too_large");
});
test("initial order and each message enforce aggregate at boundary and plus one without allocating payload", () => {
  for (const purpose of ["initial_order", "message"]) {
    expect(assertAttachmentLimits(purpose, files(5))).toBe(BATCH_MAX_BYTES);
    expect(() =>
      assertAttachmentLimits(purpose, [
        ...files(5),
        { id: "extra", sizeBytes: 1 },
      ]),
    ).toThrow("batch_too_large");
    expect(assertAttachmentLimits(purpose, [])).toBe(0);
  }
  // A later message starts its own allowance, not a conversation-wide counter.
  expect(assertAttachmentLimits("message", files(5))).toBe(BATCH_MAX_BYTES);
});
test("no invented aggregate ceiling for revisions followup or retouches; every file remains bounded and duplicates rejected", () => {
  for (const purpose of ["order_version", "followup", "retouch"])
    expect(assertAttachmentLimits(purpose, files(6))).toBe(1200000000);
  expect(() => assertAttachmentLimits("conversation", [])).toThrow(
    "invalid_purpose",
  );
  expect(() =>
    assertAttachmentLimits("initial_order", [
      { id: "x", sizeBytes: 1 },
      { id: "x", sizeBytes: 1 },
    ]),
  ).toThrow("duplicate_file");
  expect(() =>
    assertAttachmentLimits("followup", [
      { id: "x", sizeBytes: FILE_MAX_BYTES + 1 },
    ]),
  ).toThrow("file_too_large");
});
async function collect(
  source,
  declared,
  signal = new globalThis.AbortController().signal,
) {
  const parts = [];
  for await (const bytes of boundedUploadBytes(source, declared, signal))
    parts.push([...bytes]);
  return parts;
}
async function* chunks(...parts) {
  yield* parts;
}
test("stream is incremental, checks actual bytes and does not yield oversized chunk", async () => {
  const source = chunks(new Uint8Array([1, 2]), new Uint8Array([3]));
  expect(await collect(source, 3)).toEqual([[1, 2], [3]]);
  const yielded = [];
  await expect(
    (async () => {
      for await (const b of boundedUploadBytes(
        chunks(new Uint8Array([1]), new Uint8Array([2, 3])),
        2,
        new globalThis.AbortController().signal,
      ))
        yielded.push([...b]);
    })(),
  ).rejects.toThrow("size_mismatch");
  expect(yielded).toEqual([[1]]);
  await expect(collect(chunks(new Uint8Array([1])), 2)).rejects.toThrow(
    "size_mismatch",
  );
  await expect(collect(chunks(), 1)).rejects.toThrow("size_mismatch");
  await expect(collect(chunks(new Uint8Array()), 1)).rejects.toThrow(
    "invalid_chunk",
  );
  await expect(collect(chunks("bytes"), 1)).rejects.toThrow("invalid_chunk");
});
test("invalid declarations never consume source; cancellation and upstream failure propagate and close iterator", async () => {
  let consumed = false,
    closed = false;
  async function* source() {
    try {
      consumed = true;
      yield new Uint8Array([1]);
      throw new Error("UPSTREAM");
    } finally {
      closed = true;
    }
  }
  await expect(collect(source(), FILE_MAX_BYTES + 1)).rejects.toThrow(
    "file_too_large",
  );
  expect(consumed).toBe(false);
  const controller = new globalThis.AbortController();
  controller.abort();
  await expect(collect(source(), 1, controller.signal)).rejects.toThrow();
  expect(consumed).toBe(false);
  await expect(collect(source(), 2)).rejects.toThrow("UPSTREAM");
  expect(closed).toBe(true);
  const c = new globalThis.AbortController();
  closed = false;
  async function* interrupted() {
    try {
      yield new Uint8Array([1]);
      c.abort();
      yield new Uint8Array([2]);
    } finally {
      closed = true;
    }
  }
  await expect(collect(interrupted(), 2, c.signal)).rejects.toThrow();
  expect(closed).toBe(true);
});
