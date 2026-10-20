import type { Express } from "express";
import { readSessionCookie, mutationOriginAllowed } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import { sendProblem } from "../../shared/problems.js";
import { MessageFilesQuerySchema } from "./files.service.js";
import type { createMessageFilesService } from "./files.service.js";
// Prepared route only: never mounted in the application runtime.
export function registerMessageFilesRoutes(
  app: Express,
  services: {
    files: ReturnType<typeof createMessageFilesService>;
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
    origin: string;
  },
) {
  if (!mutationOriginAllowed(services.origin, services.origin))
    throw new Error("INVALID_MESSAGE_ORIGIN");
  app.post("/api/v1/messages/files", async (req, res) => {
    if (!mutationOriginAllowed(req.headers.origin, services.origin)) {
      sendProblem(res, "FORBIDDEN", 403);
      return;
    }
    if (
      !req.is("application/json") ||
      Object.keys(req.query).length ||
      !MessageFilesQuerySchema.safeParse(req.body).success
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
    const checked = await services.files.list(actor, req.body);
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
