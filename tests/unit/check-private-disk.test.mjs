import { test, expect } from "vitest";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { checkPrivateDisk } from "../../scripts/check-private-disk.mjs";

async function privateRoot() {
  const parent = path.join(process.cwd(), ".local");
  await mkdir(parent, { recursive: true, mode: 0o700 });
  return mkdtemp(path.join(parent, "disk-probe-"));
}

test("signals capacity without reserving or changing a private directory", async () => {
  const root = await privateRoot();
  try {
    expect(
      await checkPrivateDisk(root, 11, async () => ({ bavail: 10, bsize: 1 })),
    ).toEqual({
      state: "low",
      availableBytes: 10,
    });
    expect(
      await checkPrivateDisk(root, 10, async () => ({ bavail: 10, bsize: 1 })),
    ).toEqual({
      state: "ok",
      availableBytes: 10,
    });
    await expect(
      checkPrivateDisk(root, 1, async () => ({ bavail: NaN, bsize: 1 })),
    ).rejects.toThrow("DISK_MONITOR_PROBE_INVALID");
  } finally {
    await rm(root, { recursive: true });
  }
});

test("refuses absent policy, a symlink root and an unavailable probe", async () => {
  const root = await privateRoot();
  const link = root + "-link";
  try {
    await symlink(root, link);
    await expect(checkPrivateDisk("relative", 1)).rejects.toThrow(
      "DISK_MONITOR_POLICY_REQUIRED",
    );
    await expect(checkPrivateDisk(root, 0)).rejects.toThrow(
      "DISK_MONITOR_POLICY_REQUIRED",
    );
    await expect(checkPrivateDisk(link, 1)).rejects.toThrow(
      "DISK_MONITOR_ROOT_INVALID",
    );
    await expect(
      checkPrivateDisk(root, 1, async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow("offline");
  } finally {
    await rm(link);
    await rm(root, { recursive: true });
  }
});
