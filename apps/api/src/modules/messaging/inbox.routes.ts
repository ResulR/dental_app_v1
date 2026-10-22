import type { Express } from "express";
import { MessagingInboxQuerySchema } from "@dental-lab/contracts";
import { mutationOriginAllowed, readSessionCookie } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import type { createMessagingInboxService } from "./inbox.service.js";
import { sendProblem } from "../../shared/problems.js";
export function registerMessagingInboxRoutes(
  app: Express,
  services: {
    inbox: ReturnType<typeof createMessagingInboxService>;
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
    origin: string;
  },
) {
  if (!mutationOriginAllowed(services.origin, services.origin))
    throw new Error("INVALID_MESSAGING_INBOX_ORIGIN");
  app.post("/api/v1/messaging/inbox/list", async (req, res) => {
    if (!mutationOriginAllowed(req.headers.origin, services.origin))
      return sendProblem(res, "FORBIDDEN", 403);
    if (
      !req.is("application/json") ||
      Object.keys(req.query).length ||
      !MessagingInboxQuerySchema.safeParse(req.body).success
    )
      return sendProblem(res, "VALIDATION_FAILED", 400);
    const token = readSessionCookie(req.headers.cookie);
    const actor = token ? await services.sessions.authenticate(token) : null;
    if (!actor) return sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
    const result = await services.inbox.list(actor, req.body);
    if (result.kind !== "result")
      return sendProblem(
        res,
        result.kind === "denied"
          ? "FORBIDDEN"
          : result.kind === "unavailable"
            ? "DEPENDENCY_UNAVAILABLE"
            : "VALIDATION_FAILED",
        result.kind === "denied"
          ? 403
          : result.kind === "unavailable"
            ? 503
            : 400,
      );
    res.json(result.result);
  });
}
