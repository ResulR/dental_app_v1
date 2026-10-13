import { expect, test } from "vitest";
import { spawnSync } from "node:child_process";
test("private entry points refuse the development identity without disclosing input or opening a bootstrap", () => {
  expect(process.getuid()).toBe(1002);
  const secret = "synthetic-private-input-never-echo";
  for (const mode of ["hash", "commit"]) {
    const result = spawnSync(
      "/usr/bin/node",
      [
        "--v8-pool-size=1",
        "--max-old-space-size=96",
        "scripts/owner-bootstrap-worker.mjs",
        mode,
      ],
      {
        input: JSON.stringify({ password: secret }),
        encoding: "utf8",
        timeout: 5000,
        env: {
          PATH: "/usr/bin:/bin",
          UV_THREADPOOL_SIZE: "1",
          DENTAL_LAB_BOOTSTRAP_APPROVED: "private-first-owner-v1",
        },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("BOOTSTRAP_STOP_INSPECT_PRIVATE_PENDING\n");
    expect(result.stderr).not.toContain(secret);
  }
  const supervisor = spawnSync(
    "/usr/bin/python3",
    ["-I", "scripts/owner-bootstrap-admin.py"],
    { encoding: "utf8", timeout: 5000, env: { PATH: "/usr/bin:/bin" } },
  );
  expect(supervisor.status).toBe(1);
  expect(supervisor.stdout).toBe("");
  expect(supervisor.stderr).toContain("BOOTSTRAP_STOP");
  expect(supervisor.stderr).not.toContain("Traceback");
});
