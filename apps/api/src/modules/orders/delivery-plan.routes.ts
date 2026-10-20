import type { Express } from "express";
import {
  DeliveryPlanQuerySchema,
  DeliveryPlanCommandSchema,
} from "@dental-lab/contracts";
import { readSessionCookie, mutationOriginAllowed } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import type { createDeliveryPlanService } from "./delivery-plan.service.js";
import { sendProblem } from "../../shared/problems.js";
export function registerDeliveryPlanRoutes(
  app: Express,
  services: {
    service: ReturnType<typeof createDeliveryPlanService>;
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
    origin: string;
  },
) {
  if (!mutationOriginAllowed(services.origin, services.origin))
    throw new Error("INVALID_DELIVERY_PLAN_ORIGIN");
  for (const action of ["context", "update"] as const)
    app.post("/api/v1/orders/delivery-plan-" + action, async (req, res) => {
      if (!mutationOriginAllowed(req.headers.origin, services.origin)) {
        sendProblem(res, "FORBIDDEN", 403);
        return;
      }
      const schema =
        action === "context"
          ? DeliveryPlanQuerySchema
          : DeliveryPlanCommandSchema;
      if (
        !req.is("application/json") ||
        Object.keys(req.query).length ||
        !schema.safeParse(req.body).success
      ) {
        sendProblem(res, "VALIDATION_FAILED", 400);
        return;
      }
      const token = readSessionCookie(req.headers.cookie);
      const actor = token ? await services.sessions.authenticate(token) : null;
      if (!actor) {
        sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
        return;
      }
      const outcome = await services.service[action](actor, req.body);
      if (outcome.kind !== "result") {
        sendProblem(
          res,
          outcome.kind === "denied" ? "FORBIDDEN" : "VALIDATION_FAILED",
          outcome.kind === "denied" ? 403 : 400,
        );
        return;
      }
      res.json(outcome.result);
    });
}
