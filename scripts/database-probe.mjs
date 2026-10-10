// Administrator-only real-client test, never run as dental-ai.
import { createApplicationDatabase } from "../apps/api/dist/shared/database.js";
if (process.getuid() === 0 || process.getuid() === 1002) {
  throw new Error("PROBE_DEDICATED_IDENTITY_REQUIRED");
}
const database = createApplicationDatabase(process.env);
try {
  const result = await database.query("SELECT 1::integer AS ok");
  if (result.rows.length !== 1 || result.rows[0].ok !== 1)
    throw new Error("PROBE_FAILED");
  console.log(
    JSON.stringify({
      test: "real_pg_client",
      database: "dental_lab",
      result: "passed",
    }),
  );
} catch {
  console.error(JSON.stringify({ test: "real_pg_client", result: "failed" }));
  process.exitCode = 1;
} finally {
  await database.close();
}
