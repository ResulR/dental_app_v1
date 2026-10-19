import type { Express } from "express";
import {
  OrderModificationProposalSchema,
  OrderModificationDecisionSchema,
  OrderLifecycleContextQuerySchema,
} from "@dental-lab/contracts";
import { readSessionCookie, mutationOriginAllowed } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import type { createOrderModificationService } from "./modification.service.js";
import { sendProblem } from "../../shared/problems.js";
export function registerOrderModificationRoutes(
  app: Express,
  services: {
    service: ReturnType<typeof createOrderModificationService>;
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
    origin: string;
  },
) {
  if (!mutationOriginAllowed(services.origin, services.origin))
    throw new Error("INVALID_REQUEST_ORIGIN");
  for (const action of ["propose", "context", "decide"] as const)
    app.post("/api/v1/orders/modification-" + action, async (req, res) => {
      if (!mutationOriginAllowed(req.headers.origin, services.origin)) {
        sendProblem(res, "FORBIDDEN", 403);
        return;
      }
      const parsed = (
        action === "propose"
          ? OrderModificationProposalSchema
          : action === "decide"
            ? OrderModificationDecisionSchema
            : OrderLifecycleContextQuerySchema
      ).safeParse(req.body);
      if (
        !req.is("application/json") ||
        Object.keys(req.query).length ||
        !parsed.success
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
      const checked = await services.service[action](actor, parsed.data);
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
