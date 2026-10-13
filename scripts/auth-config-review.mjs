import { fileURLToPath } from "node:url";
import { readConfig } from "../apps/api/dist/app/config.js";
import { readAuthConfig } from "../apps/api/dist/app/auth-config.js";
import { applicationPoolConfig } from "../apps/api/dist/shared/database.js";
const keys = [
  "NODE_ENV",
  "DENTAL_LAB_PORT",
  "DENTAL_LAB_AUTH_ENABLED",
  "DENTAL_LAB_ORIGIN",
  "DENTAL_LAB_SESSION_LIFETIME_MS",
  "DENTAL_LAB_SESSION_ABSOLUTE_MS",
  "DENTAL_LAB_LOGIN_WINDOW_MS",
  "DENTAL_LAB_LOGIN_ACCOUNT_ATTEMPTS",
  "DENTAL_LAB_LOGIN_NETWORK_ATTEMPTS",
  "DENTAL_LAB_LOGIN_MAX_KEYS",
  "PGDATABASE",
  "PGHOST",
  "PGPORT",
  "PGUSER",
].sort();
export function reviewAuthConfig(value) {
  if (
    !value ||
    Object.keys(value).sort().join(",") !== keys.join(",") ||
    Object.values(value).some(
      (item) => typeof item !== "string" || !/^[A-Za-z0-9:/._-]+$/.test(item),
    ) ||
    value.NODE_ENV !== "production" ||
    value.DENTAL_LAB_AUTH_ENABLED !== "true"
  )
    throw new Error("AUTH_REVIEW_CONFIG_INVALID");
  readConfig(value);
  readAuthConfig(value);
  applicationPoolConfig(value);
  return keys.map((key) => key + "=" + value[key]).join("\n") + "\n";
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    let raw = "";
    for await (const part of process.stdin) {
      raw += part.toString("utf8");
      if (Buffer.byteLength(raw) > 8192) throw new Error("CONFIG_TOO_LARGE");
    }
    process.stdout.write(reviewAuthConfig(JSON.parse(raw)));
  } catch {
    process.stderr.write("AUTH_REVIEW_CONFIG_INVALID\n");
    process.exitCode = 1;
  }
}
