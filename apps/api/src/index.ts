import path from "node:path";
import { fileURLToPath } from "node:url";
import { readConfig } from "./app/config.js";
import { closeServer, startServer } from "./app/server.js";
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
        console.error("API_STOP_FAILED");
      });
    };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    console.log("API_STARTED");
  } catch {
    console.error("API_START_FAILED");
    process.exitCode = 1;
  }
}
