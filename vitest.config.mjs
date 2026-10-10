import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.mjs", "tests/integration/**/*.test.mjs"],
    environment: "node",
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
    execArgv: ["--v8-pool-size=1", "--max-old-space-size=192"],
    testTimeout: 5000,
    hookTimeout: 5000,
  },
});
