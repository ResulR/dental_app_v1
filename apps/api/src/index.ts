import path from "node:path";
import { fileURLToPath } from "node:url";
import { readConfig } from "./app/config.js";
import { closeServer, startServer } from "./app/server.js";
import { createTechnicalLogger } from "./shared/logging.js";
const log = createTechnicalLogger();
export const applicationName = "dental-lab-api";
if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    const server = await startServer(readConfig(process.env));
    let closing = false;
    const stop = () => {
      if (closing) return;
      closing = true;
      void closeServer(server).catch(() => {
        process.exitCode = 1;
        log({ event: "api_stop_failed" });
      });
    };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    log({ event: "api_started" });
  } catch {
    log({ event: "api_start_failed" });
    process.exitCode = 1;
  }
}
