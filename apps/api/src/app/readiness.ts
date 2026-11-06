import type { Express } from "express";
import type { DatabaseExecutor } from "../shared/database.js";

// Readiness is separate from process liveness. Never expose SQL, credentials,
// database identity, or an exception to the caller.
export function registerReadinessRoute(
  app: Express,
  database: Pick<DatabaseExecutor, "query">,
) {
  app.get("/ready", async (req, res) => {
    res.locals.routeId = "ready";
    if (Object.keys(req.query).length) {
      res.status(400).json({ status: "unavailable" });
      return;
    }
    try {
      const result = await database.query("SELECT 1 AS ready");
      if (result.rows.length !== 1 || result.rows[0]?.ready !== 1)
        throw new Error("READINESS_RESULT_INVALID");
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });
}
