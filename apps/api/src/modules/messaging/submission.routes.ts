import type { Express } from "express";
import { MessageSubmissionSchema } from "@dental-lab/contracts";
import { readSessionCookie, mutationOriginAllowed } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import type { createMessageSubmissionService } from "./submission.service.js";
import { sendProblem } from "../../shared/problems.js";
// Prepared route: NOT registered by application runtime.
export function registerMessageSubmissionRoutes(
  app: Express,
  services: {
    service: ReturnType<typeof createMessageSubmissionService>;
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
    origin: string;
  },
) {
  if (!mutationOriginAllowed(services.origin, services.origin))
    throw new Error("INVALID_MESSAGE_ORIGIN");
  app.post("/api/v1/messages", async (req, res) => {
    if (!mutationOriginAllowed(req.headers.origin, services.origin)) {
      sendProblem(res, "FORBIDDEN", 403);
      return;
    }
    if (
      !req.is("application/json") ||
      Object.keys(req.query).length ||
      !MessageSubmissionSchema.safeParse(req.body).success
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
    const checked = await services.service.send(actor, req.body);
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
