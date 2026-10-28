import { test, expect } from "vitest";
import { uploadProgress } from "../../apps/api/src/modules/files/upload-progress.ts";
const hash = "a".repeat(64);
test("reports exact server verified bytes and missing fragments for explicit resumption", () => {
  const one = uploadProgress(
    7,
    3,
    [{ index: 1, sizeBytes: 3, sha256: hash }],
    3,
  );
  expect(one).toEqual({
    declaredSize: 7,
    receivedBytes: 3,
    complete: false,
    missing: [0, 2],
  });
  expect(
    uploadProgress(
      7,
      3,
      [
        { index: 0, sizeBytes: 3, sha256: hash },
        { index: 1, sizeBytes: 3, sha256: hash },
        { index: 2, sizeBytes: 1, sha256: hash },
      ],
      3,
    ).complete,
  ).toBe(true);
});
test("duplicate, forged receipt, mismatch or unbounded policy fail closed", () => {
  const r = { index: 0, sizeBytes: 3, sha256: hash };
  for (const receipts of [
    [r, r],
    [{ ...r, sizeBytes: 2 }],
    [{ ...r, sha256: "x" }],
    [{ ...r, index: 3 }],
  ])
    expect(() => uploadProgress(7, 3, receipts, 3)).toThrow(
      "UPLOAD_PROGRESS_INCONSISTENT",
    );
  expect(() => uploadProgress(200_000_000, 1, [], 100)).toThrow(
    "UPLOAD_PROGRESS_POLICY",
  );
});
