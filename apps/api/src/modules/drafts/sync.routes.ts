import type { Express } from "express";
import { readSessionCookie, mutationOriginAllowed } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import { sendProblem } from "../../shared/problems.js";
import type { createDraftSyncService } from "./sync.service.js";

export function registerDraftSyncRoutes(
  app: Express,
  services: {
    service: ReturnType<typeof createDraftSyncService>;
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
    origin: string;
  },
) {
  if (!mutationOriginAllowed(services.origin, services.origin))
    throw new Error("INVALID_DRAFT_SYNC_ORIGIN");
  for (const action of ["list", "read", "commit"] as const)
    app.post("/api/v1/drafts/" + action, async (req, res) => {
      if (!mutationOriginAllowed(req.headers.origin, services.origin)) {
        sendProblem(res, "FORBIDDEN", 403);
        return;
      }
      if (!req.is("application/json") || Object.keys(req.query).length) {
        sendProblem(res, "VALIDATION_FAILED", 400);
        return;
      }
      const token = readSessionCookie(req.headers.cookie);
      const actor = token ? await services.sessions.authenticate(token) : null;
      if (!actor) {
        sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
        return;
      }
      const result = await services.service[action](actor, req.body);
      if (result.kind !== "result") {
        sendProblem(
          res,
          result.kind === "denied" ? "FORBIDDEN" : "VALIDATION_FAILED",
          result.kind === "denied" ? 403 : 400,
        );
        return;
      }
      res.json(result.value);
    });
}
