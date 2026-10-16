import type { Express } from "express";
import {
  OrderSearchSchema,
  OrderDetailQuerySchema,
} from "@dental-lab/contracts";
import { readSessionCookie, mutationOriginAllowed } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import type { createOrderTrackingService } from "./tracking.service.js";
import { sendProblem } from "../../shared/problems.js";
export function registerOrderTrackingRoutes(
  app: Express,
  services: {
    service: ReturnType<typeof createOrderTrackingService>;
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
    origin: string;
  },
) {
  for (const action of ["search", "detail"] as const)
    app.post("/api/v1/orders/" + action, async (req, res) => {
      if (!mutationOriginAllowed(req.headers.origin, services.origin)) {
        sendProblem(res, "FORBIDDEN", 403);
        return;
      }
      const schema =
        action === "search" ? OrderSearchSchema : OrderDetailQuerySchema;
      if (
        !req.is("application/json") ||
        Object.keys(req.query).length ||
        !schema.safeParse(req.body).success
      ) {
        sendProblem(res, "VALIDATION_FAILED", 400);
        return;
      }
      const token = readSessionCookie(req.headers.cookie),
        actor = token ? await services.sessions.authenticate(token) : null;
      if (!actor) {
        sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
        return;
      }
      const result = await services.service[action](actor, req.body);
      if (result.kind === "invalid" || result.kind === "denied") {
        sendProblem(
          res,
          result.kind === "denied" ? "FORBIDDEN" : "VALIDATION_FAILED",
          result.kind === "denied" ? 403 : 400,
        );
        return;
      }
      res.json(result.kind === "page" ? result.page : result.detail);
    });
}
