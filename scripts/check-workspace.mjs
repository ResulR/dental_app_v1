import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const root = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url)),
);
assert.equal(root.private, true);
assert.deepEqual(root.workspaces, [
  "apps/web",
  "apps/api",
  "packages/contracts",
]);
for (const folder of root.workspaces) {
  const p = JSON.parse(
    await readFile(new URL("../" + folder + "/package.json", import.meta.url)),
  );
  assert.equal(p.private, true);
  assert.equal(p.type, "module");
}
const { contractVersion } = await import("@dental-lab/contracts");
assert.equal(contractVersion, 3);
console.log("Workspace manifests and shared package resolution OK");
