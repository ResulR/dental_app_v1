import type { Express } from "express";
import {
  DeliveryPriorityQuerySchema,
  DeliveryPriorityCommandSchema,
} from "@dental-lab/contracts";
import { readSessionCookie, mutationOriginAllowed } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import type { createDeliveryPriorityService } from "./delivery-priority.service.js";
import { sendProblem } from "../../shared/problems.js";
export function registerDeliveryPriorityRoutes(
  app: Express,
  services: {
    service: ReturnType<typeof createDeliveryPriorityService>;
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
    origin: string;
  },
) {
  if (!mutationOriginAllowed(services.origin, services.origin))
    throw new Error("INVALID_DELIVERY_PRIORITY_ORIGIN");
  for (const action of ["context", "update"] as const)
    app.post("/api/v1/orders/delivery-priority-" + action, async (req, res) => {
      if (!mutationOriginAllowed(req.headers.origin, services.origin)) {
        sendProblem(res, "FORBIDDEN", 403);
        return;
      }
      const schema =
        action === "context"
          ? DeliveryPriorityQuerySchema
          : DeliveryPriorityCommandSchema;
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
      const checked = await services.service[action](actor, req.body);
      if (checked.kind !== "result") {
        sendProblem(
          res,
          checked.kind === "denied" ? "FORBIDDEN" : "VALIDATION_FAILED",
          checked.kind === "denied" ? 403 : 400,
        );
        return;
      }
      res.json(checked.result);
    });
}
