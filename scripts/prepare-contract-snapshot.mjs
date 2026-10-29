import fs from "node:fs";
import { contractVersion, exportJsonSchemas } from "@dental-lab/contracts";
fs.writeFileSync(
  `docs/contracts/runtime-v${contractVersion}.snapshot.json`,
  JSON.stringify(
    { version: contractVersion, schemas: exportJsonSchemas() },
    null,
    2,
  ) + "\n",
  { flag: "wx", mode: 0o600 },
);
console.log("New snapshot prepared; existing snapshot is never overwritten");
