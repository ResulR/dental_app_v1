import { randomUUID } from "node:crypto";
import { withRequestCorrelation } from "../shared/request-correlation.js";
import type { RequestHandler } from "express";
import type { TechnicalLogger } from "../shared/logging.js";
export function requestContext(log: TechnicalLogger): RequestHandler {
  return (req, res, next) => {
    const id = randomUUID();
    res.locals.requestId = id;
    res.locals.routeId = "unmatched";
    res.set("X-Request-Id", id);
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "no-referrer");
    res.set("Cross-Origin-Resource-Policy", "same-origin");
    res.set("X-Frame-Options", "DENY");
    res.set(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'",
    );
    const start = process.hrtime.bigint();
    let recorded = false;
    const record = (completed: boolean) => {
      if (recorded) return;
      recorded = true;
      log({
        event: completed ? "request_completed" : "request_aborted",
        requestId: id,
        route: ["health", "ready"].includes(res.locals.routeId)
          ? res.locals.routeId
          : "unmatched",
        method: req.method,
        status: completed ? res.statusCode : 0,
        durationMs: Number(process.hrtime.bigint() - start) / 1e6,
      });
    };
    res.once("finish", () => {
      record(true);
    });
    res.once("close", () => {
      record(res.writableFinished);
    });
    withRequestCorrelation(id, next);
  };
}
