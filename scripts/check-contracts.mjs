import assert from "node:assert/strict";
import fs from "node:fs";
import { contractVersion, exportJsonSchemas } from "@dental-lab/contracts";
const expected = JSON.parse(
  fs.readFileSync("docs/contracts/runtime-v1.snapshot.json", "utf8"),
);
assert.equal(expected.version, contractVersion);
assert.deepEqual(
  exportJsonSchemas(),
  expected.schemas,
  "Contract drift: review/version the change; never regenerate baseline to hide a failure",
);
console.log("Runtime contract snapshot and version OK");
