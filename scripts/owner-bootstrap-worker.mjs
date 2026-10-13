import { userInfo } from "node:os";
import pg from "pg";
import { hashPassword } from "../apps/api/dist/modules/identity/index.js";
import {
  provisionFirstOwner,
  validateApproval,
  validatePrepared,
} from "./owner-bootstrap-core.mjs";

async function readPrivateInput() {
  const parts = [];
  let length = 0;
  try {
    for await (const part of process.stdin) {
      length += part.length;
      if (length > 8192) throw new Error("INPUT_TOO_LARGE");
      parts.push(part);
    }
    const bytes = Buffer.concat(parts);
    try {
      return JSON.parse(bytes.toString("utf8"));
    } finally {
      bytes.fill(0);
    }
  } finally {
    for (const part of parts) part.fill(0);
  }
}
async function main() {
  const mode = process.argv[2];
  if (
    process.argv.length !== 3 ||
    process.stdin.isTTY ||
    process.env.DENTAL_LAB_BOOTSTRAP_APPROVED !== "private-first-owner-v1"
  )
    throw new Error("BOOTSTRAP_INVOCATION_REFUSED");
  if (
    mode === "hash" &&
    process.getuid() === 994 &&
    userInfo().username === "dental-lab-runtime"
  ) {
    const input = await readPrivateInput();
    const approval = validateApproval(input.approval);
    if (Object.keys(input).sort().join(",") !== "approval,password")
      throw new Error("BOOTSTRAP_INPUT_INVALID");
    const passwordHash = await hashPassword(input.password);
    input.password = "";
    // Pipe only: supervisor captures this sensitive result in memory, never a log.
    process.stdout.write(JSON.stringify({ approval, passwordHash }));
  } else if (
    mode === "commit" &&
    userInfo().username === "postgres" &&
    process.getuid() !== 0
  ) {
    const input = validatePrepared(await readPrivateInput());
    const client = new pg.Client({
      host: "/var/run/postgresql",
      port: 5432,
      database: "dental_lab",
      user: "postgres",
      application_name: "dental-lab-first-owner",
      connectionTimeoutMillis: 5000,
      query_timeout: 7000,
    });
    client.on("error", () => {});
    try {
      await client.connect();
      const result = await provisionFirstOwner(client, input);
      input.passwordHash = "";
      process.stdout.write(JSON.stringify(result));
    } finally {
      await client.end();
    }
  } else throw new Error("BOOTSTRAP_IDENTITY_REFUSED");
}
main().catch(() => {
  // Never print database exceptions, SQL DETAIL, input or a stack/cause.
  process.stderr.write("BOOTSTRAP_STOP_INSPECT_PRIVATE_PENDING\n");
  process.exitCode = 1;
});
