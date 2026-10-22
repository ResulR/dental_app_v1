import type { Express } from "express";
import {
  GeneralConversationQuerySchema,
  GeneralMessageQuerySchema,
  GeneralReadCommandSchema,
  MessageSubmissionSchema,
} from "@dental-lab/contracts";
import { readSessionCookie, mutationOriginAllowed } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import { sendProblem } from "../../shared/problems.js";
import type { createGeneralMessagingService } from "./general.service.js";
import type { createMessageSubmissionService } from "./submission.service.js";

export function registerGeneralMessagingRoutes(
  app: Express,
  services: {
    reader: ReturnType<typeof createGeneralMessagingService>;
    sender: ReturnType<typeof createMessageSubmissionService>;
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
    origin: string;
  },
) {
  if (!mutationOriginAllowed(services.origin, services.origin))
    throw new Error("INVALID_GENERAL_MESSAGING_ORIGIN");
  for (const action of [
    "conversations",
    "messages",
    "markRead",
    "send",
  ] as const) {
    app.post("/api/v1/messaging/general/" + action, async (req, res) => {
      if (!mutationOriginAllowed(req.headers.origin, services.origin)) {
        sendProblem(res, "FORBIDDEN", 403);
        return;
      }
      const schema =
        action === "conversations"
          ? GeneralConversationQuerySchema
          : action === "messages"
            ? GeneralMessageQuerySchema
            : action === "markRead"
              ? GeneralReadCommandSchema
              : MessageSubmissionSchema;
      if (
        !req.is("application/json") ||
        Object.keys(req.query).length ||
        !schema.safeParse(req.body).success ||
        (action === "send" &&
          (req.body.file_ids.length !== 0 || req.body.body === null))
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
      const result =
        action === "send"
          ? await services.sender.send(actor, req.body)
          : await services.reader[action](actor, req.body);
      if (result.kind !== "result") {
        sendProblem(
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
        return;
      }
      res.json(result.result);
    });
  }
}
