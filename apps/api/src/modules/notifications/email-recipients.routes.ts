import type { Express } from "express";
import {
  ClinicIdSchema,
  EmailRecipientCommandSchema,
} from "@dental-lab/contracts";
import { readSessionCookie, mutationOriginAllowed } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import { sendProblem } from "../../shared/problems.js";
import { type createEmailRecipientsService } from "./email-recipients.service.js";

export function registerEmailRecipientsRoutes(
  app: Express,
  services: {
    repository: ReturnType<typeof createEmailRecipientsService>;
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
    origin: string;
  },
) {
  if (!mutationOriginAllowed(services.origin, services.origin))
    throw new Error("INVALID_EMAIL_RECIPIENT_ORIGIN");
  app.get(
    "/api/v1/notifications/email-recipients/:accountId",
    async (req, res) => {
      if (
        !ClinicIdSchema.safeParse(req.params.accountId).success ||
        Object.keys(req.query).length
      )
        return sendProblem(res, "VALIDATION_FAILED", 400);
      const token = readSessionCookie(req.headers.cookie);
      const actor = token ? await services.sessions.authenticate(token) : null;
      if (!actor) return sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
      const result = await services.repository.list(
        actor,
        req.params.accountId as string,
      );
      if (result.kind !== "result") return sendProblem(res, "FORBIDDEN", 403);
      return res.json(result.categories);
    },
  );
  app.put(
    "/api/v1/notifications/email-recipients/:accountId",
    async (req, res) => {
      if (!mutationOriginAllowed(req.headers.origin, services.origin))
        return sendProblem(res, "FORBIDDEN", 403);
      const command = EmailRecipientCommandSchema.safeParse(req.body);
      if (
        !ClinicIdSchema.safeParse(req.params.accountId).success ||
        Object.keys(req.query).length ||
        !req.is("application/json") ||
        !command.success
      )
        return sendProblem(res, "VALIDATION_FAILED", 400);
      const token = readSessionCookie(req.headers.cookie);
      const actor = token ? await services.sessions.authenticate(token) : null;
      if (!actor) return sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
      const result = await services.repository.change(
        actor,
        req.params.accountId as string,
        command.data.category,
        command.data.expected_selected,
        command.data.selected,
      );
      return res
        .status(
          result.kind === "applied"
            ? 200
            : result.kind === "denied"
              ? 403
              : 409,
        )
        .json(result);
    },
  );
}
