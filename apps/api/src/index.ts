import path from "node:path";
import { fileURLToPath } from "node:url";
import { readConfig } from "./app/config.js";
import { closeServer, startServer } from "./app/server.js";
import { createTechnicalLogger } from "./shared/logging.js";
import { createRuntime } from "./app/runtime.js";
const log = createTechnicalLogger();
export const applicationName = "dental-lab-api";
if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  let runtime: Awaited<ReturnType<typeof createRuntime>> | undefined;
  try {
    const config = readConfig(process.env);
    runtime = await createRuntime(process.env);
    const server = await startServer(config, runtime.registerRoutes);
    let closing = false;
    const stop = () => {
      if (closing) return;
      closing = true;
      void closeServer(server)
        .finally(() => runtime?.close())
        .catch(() => {
          process.exitCode = 1;
          log({ event: "api_stop_failed" });
        });
    };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    log({ event: "api_started" });
  } catch {
    await runtime?.close().catch(() => {});
    log({ event: "api_start_failed" });
    process.exitCode = 1;
  }
}
