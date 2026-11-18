import type { Express } from "express";
import { EmailQueueQuerySchema } from "@dental-lab/contracts";
import { readSessionCookie, mutationOriginAllowed } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import type { createEmailQueueReadService } from "./email-queue-read.service.js";
import { sendProblem } from "../../shared/problems.js";
export function registerEmailQueueReadRoutes(
  app: Express,
  services: {
    reader: ReturnType<typeof createEmailQueueReadService>;
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
    origin: string;
  },
) {
  if (!mutationOriginAllowed(services.origin, services.origin))
    throw new Error("INVALID_EMAIL_QUEUE_ORIGIN");
  app.post("/api/v1/notifications/email-queue/page", async (req, res) => {
    if (!mutationOriginAllowed(req.headers.origin, services.origin))
      return sendProblem(res, "FORBIDDEN", 403);
    if (
      !req.is("application/json") ||
      Object.keys(req.query).length ||
      !EmailQueueQuerySchema.safeParse(req.body).success
    )
      return sendProblem(res, "VALIDATION_FAILED", 400);
    const token = readSessionCookie(req.headers.cookie);
    const actor = token ? await services.sessions.authenticate(token) : null;
    if (!actor) return sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
    const output = await services.reader.page(actor, req.body);
    if (output.kind !== "result")
      return sendProblem(
        res,
        output.kind === "denied" ? "FORBIDDEN" : "VALIDATION_FAILED",
        output.kind === "denied" ? 403 : 400,
      );
    res.json(output.result);
  });
}
