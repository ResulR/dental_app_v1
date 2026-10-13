// Operator-only recipe. No server/proxy/browser installation performed here.
import fs from "node:fs";
import { defineConfig } from "@playwright/test";
const origin = process.env.DENTAL_LAB_HTTPS_ORIGIN;
const state = process.env.DENTAL_LAB_HTTPS_STORAGE_STATE;
if (
  process.getuid?.() === 0 ||
  process.getuid?.() === 1002 ||
  process.env.DENTAL_LAB_HTTPS_RECIPE_APPROVED !== "dedicated-auth-recipe-v1" ||
  !origin ||
  !state ||
  new URL(origin).origin !== origin ||
  new URL(origin).protocol !== "https:"
)
  throw new Error("HTTPS_RECIPE_OPERATOR_APPROVAL_REQUIRED");
const info = fs.lstatSync(state);
if (
  !info.isFile() ||
  info.isSymbolicLink() ||
  info.nlink !== 1 ||
  info.uid !== process.getuid?.() ||
  (info.mode & 0o077) !== 0 ||
  info.size > 16384
)
  throw new Error("HTTPS_RECIPE_PRIVATE_STATE_REQUIRED");
export default defineConfig({
  testDir: "./tests/https-auth",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 20000,
  globalTimeout: 60000,
  reporter: "line",
  outputDir: ".local/https-recipe-results",
  use: {
    baseURL: origin,
    storageState: state,
    ignoreHTTPSErrors: false,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
