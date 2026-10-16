import type { Express } from "express";
import { readSessionCookie } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import type { createOrderReviewService } from "./review.service.js";
import { sendProblem } from "../../shared/problems.js";
export function registerOrderReviewRoutes(
  app: Express,
  services: {
    service: ReturnType<typeof createOrderReviewService>;
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
  },
) {
  app.get("/api/v1/orders/review", async (req, res) => {
    if (Object.keys(req.query).some((k) => k !== "after")) {
      sendProblem(res, "VALIDATION_FAILED", 400);
      return;
    }
    const token = readSessionCookie(req.headers.cookie),
      actor = token ? await services.sessions.authenticate(token) : null;
    if (!actor) {
      sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
      return;
    }
    const result = await services.service.list(actor, req.query.after);
    if (result.kind !== "page") {
      sendProblem(
        res,
        result.kind === "denied" ? "FORBIDDEN" : "VALIDATION_FAILED",
        result.kind === "denied" ? 403 : 400,
      );
      return;
    }
    res.json(result.page);
  });
}
