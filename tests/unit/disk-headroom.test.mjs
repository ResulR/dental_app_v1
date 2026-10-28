import { test, expect, vi } from "vitest";
import { requireDiskHeadroom } from "../../apps/api/src/modules/files/disk-headroom.ts";
test("pauses when the measured free space cannot cover incoming bytes plus explicit reserve", async () => {
  const probe = vi.fn(async () => ({ bavail: 10, bsize: 1 }));
  expect(await requireDiskHeadroom("/private", 7, 4, probe)).toEqual({
    kind: "paused",
  });
  expect(await requireDiskHeadroom("/private", 6, 4, probe)).toEqual({
    kind: "admissible",
  });
  expect(probe).toHaveBeenCalledWith("/private");
});
test("missing policy and probe failures never grant admission", async () => {
  await expect(requireDiskHeadroom("/private", 1, 0, vi.fn())).rejects.toThrow(
    "DISK_POLICY_REQUIRED",
  );
  await expect(
    requireDiskHeadroom("/private", 1, 1, async () => {
      throw new Error("disk unavailable");
    }),
  ).rejects.toThrow("disk unavailable");
  expect(
    await requireDiskHeadroom("/private", 1, 1, async () => ({
      bavail: NaN,
      bsize: 1,
    })),
  ).toEqual({ kind: "paused" });
});
