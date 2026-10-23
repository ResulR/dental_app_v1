import type { Express, Request, Response } from "express";
import {
  InternalNoticeQuerySchema,
  InternalNoticeReadSchema,
} from "@dental-lab/contracts";
import { mutationOriginAllowed, readSessionCookie } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import type { createInternalNoticeService } from "./internal.service.js";
import { sendProblem } from "../../shared/problems.js";

export function registerInternalNoticeRoutes(
  app: Express,
  services: {
    notices: ReturnType<typeof createInternalNoticeService>;
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
    origin: string;
  },
) {
  if (!mutationOriginAllowed(services.origin, services.origin))
    throw new Error("INVALID_INTERNAL_NOTICE_ORIGIN");
  async function handle(req: Request, res: Response, action: "list" | "read") {
    if (!mutationOriginAllowed(req.headers.origin, services.origin))
      return sendProblem(res, "FORBIDDEN", 403);
    const parsed = (
      action === "list" ? InternalNoticeQuerySchema : InternalNoticeReadSchema
    ).safeParse(req.body);
    if (
      !req.is("application/json") ||
      Object.keys(req.query).length ||
      !parsed.success
    )
      return sendProblem(res, "VALIDATION_FAILED", 400);
    const token = readSessionCookie(req.headers.cookie);
    const actor = token ? await services.sessions.authenticate(token) : null;
    if (!actor) return sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
    const result =
      action === "list"
        ? await services.notices.list(actor, parsed.data)
        : await services.notices.markRead(actor, parsed.data);
    if (result.kind !== "result")
      return sendProblem(
        res,
        result.kind === "denied" ? "FORBIDDEN" : "VALIDATION_FAILED",
        result.kind === "denied" ? 403 : 400,
      );
    res.json(result.result);
  }
  app.post(
    "/api/v1/notifications/internal/list",
    (req, res) => void handle(req, res, "list"),
  );
  app.post(
    "/api/v1/notifications/internal/read",
    (req, res) => void handle(req, res, "read"),
  );
}
