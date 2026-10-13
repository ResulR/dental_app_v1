import type { Server } from "node:http";
import type { AppConfig } from "./config.js";
import { createApp } from "./create-app.js";
export async function startServer(
  config: AppConfig,
  registerRoutes?: Parameters<typeof createApp>[0],
): Promise<Server> {
  const server = createApp(registerRoutes).listen(config.port, config.host);
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  return server;
}
export async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      server.closeAllConnections();
    }, 5000);
    timer.unref();
    server.close((error) => {
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    });
    server.closeIdleConnections();
  });
}
