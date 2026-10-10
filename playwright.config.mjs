import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e-api",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 10000,
  globalTimeout: 60000,
  reporter: "line",
  outputDir: ".local/playwright-results",
  use: { trace: "off", screenshot: "off", video: "off" },
});
