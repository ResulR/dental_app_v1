import express from "express";
import type { Express } from "express";
import { randomUUID } from "node:crypto";
import { errorHandler, sendProblem } from "./problems.js";
export function createApp(registerRoutes?: (app: Express) => void) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false);
  app.use((_req, res, next) => {
    res.locals.requestId = randomUUID();
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "32kb", strict: true }));
  // Process liveness only; no assertion about database/storage readiness.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  registerRoutes?.(app);
  app.use((_req, res) => {
    sendProblem(res, "RESOURCE_NOT_FOUND", 404);
  });
  app.use(errorHandler);
  return app;
}
