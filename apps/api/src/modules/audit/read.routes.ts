import type { Express } from "express";
import { AuditLogQuerySchema } from "@dental-lab/contracts";
import { readSessionCookie, mutationOriginAllowed } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import type { createAuditReadService } from "./read.service.js";
import { sendProblem } from "../../shared/problems.js";
export function registerAuditReadRoutes(
  app: Express,
  services: {
    reader: ReturnType<typeof createAuditReadService>;
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
    origin: string;
  },
) {
  if (!mutationOriginAllowed(services.origin, services.origin))
    throw new Error("INVALID_AUDIT_READ_ORIGIN");
  app.post("/api/v1/audit/page", async (req, res) => {
    if (!mutationOriginAllowed(req.headers.origin, services.origin)) {
      sendProblem(res, "FORBIDDEN", 403);
      return;
    }
    if (
      !req.is("application/json") ||
      Object.keys(req.query).length ||
      !AuditLogQuerySchema.safeParse(req.body).success
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
    const output = await services.reader.page(actor, req.body);
    if (output.kind !== "result") {
      sendProblem(
        res,
        output.kind === "denied" ? "FORBIDDEN" : "VALIDATION_FAILED",
        output.kind === "denied" ? 403 : 400,
      );
      return;
    }
    res.json(output.result);
  });
}
