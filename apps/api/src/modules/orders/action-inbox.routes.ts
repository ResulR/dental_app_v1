import type { Express } from "express";
import { ActionInboxQuerySchema } from "@dental-lab/contracts";
import { readSessionCookie, mutationOriginAllowed } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import type { createActionInboxService } from "./action-inbox.service.js";
import { sendProblem } from "../../shared/problems.js";
export function registerActionInboxRoutes(
  app: Express,
  services: {
    service: ReturnType<typeof createActionInboxService>;
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
    origin: string;
  },
) {
  if (!mutationOriginAllowed(services.origin, services.origin))
    throw new Error("INVALID_SUBMISSION_ORIGIN");
  app.post("/api/v1/orders/actions", async (req, res) => {
    if (!mutationOriginAllowed(req.headers.origin, services.origin)) {
      sendProblem(res, "FORBIDDEN", 403);
      return;
    }
    const input = ActionInboxQuerySchema.safeParse(req.body);
    if (
      !req.is("application/json") ||
      Object.keys(req.query).length ||
      !input.success
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
    const checked = await services.service.list(actor, input.data);
    if (checked.kind !== "page") {
      sendProblem(
        res,
        checked.kind === "denied" ? "FORBIDDEN" : "VALIDATION_FAILED",
        checked.kind === "denied" ? 403 : 400,
      );
      return;
    }
    res.json(checked.page);
  });
}
