import { test, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { checkLockfile } from "../../scripts/check-lockfile.mjs";

const lock = JSON.parse(
  await readFile(new URL("../../package-lock.json", import.meta.url)),
);
const clone = () => JSON.parse(JSON.stringify(lock));
const packageName = Object.keys(lock.packages).find(
  (name) => name.startsWith("node_modules/") && lock.packages[name].integrity,
);

test("accepts the pinned lockfile and denies alternate archive origins", () => {
  expect(() => checkLockfile(lock)).not.toThrow();
  for (const resolved of [
    "https://evil.example/package.tgz",
    "http://registry.npmjs.org/package.tgz",
    "https://registry.npmjs.org/package.tgz?token=secret",
  ]) {
    const changed = clone();
    changed.packages[packageName].resolved = resolved;
    expect(() => checkLockfile(changed)).toThrow("LOCKFILE_SOURCE_INVALID");
  }
});

test("rejects missing integrity and redirected workspace links", () => {
  const missing = clone();
  delete missing.packages[packageName].integrity;
  expect(() => checkLockfile(missing)).toThrow("LOCKFILE_SOURCE_INVALID");
  const changed = clone();
  changed.packages["node_modules/@dental-lab/api"].resolved =
    "packages/contracts";
  expect(() => checkLockfile(changed)).toThrow("LOCKFILE_LINK_INVALID");
});
