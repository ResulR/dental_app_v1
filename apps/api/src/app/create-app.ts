import express from "express";
import type { Express } from "express";
import { createTechnicalLogger } from "../shared/logging.js";
import type { TechnicalLogger } from "../shared/logging.js";
import { requestContext } from "./request-context.js";
import { errorHandler, sendProblem } from "./problems.js";
export function createApp(
  registerRoutes?: (app: Express) => void,
  logger: TechnicalLogger = createTechnicalLogger(),
) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false);
  app.use(requestContext(logger));
  app.use(express.json({ limit: "32kb", strict: true }));
  // Process liveness only; no assertion about database/storage readiness.
  app.get("/health", (_req, res) => {
    res.locals.routeId = "health";
    res.json({ status: "ok" });
  });
  registerRoutes?.(app);
  app.use((_req, res) => {
    sendProblem(res, "RESOURCE_NOT_FOUND", 404);
  });
  app.use(errorHandler);
  return app;
}
