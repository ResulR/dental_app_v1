import type { Express } from "express";
import {
  LaboratoryUpdateSchema,
  LaboratoryMutationResultSchema,
  RevisionSchema,
} from "@dental-lab/contracts";
import { readSessionCookie, mutationOriginAllowed } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import type { createLaboratorySettingsService } from "./settings.service.js";
import { sendProblem } from "../../shared/problems.js";
export function registerLaboratorySettingsRoutes(
  app: Express,
  services: {
    service: ReturnType<typeof createLaboratorySettingsService>;
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
    origin: string;
  },
) {
  if (!mutationOriginAllowed(services.origin, services.origin))
    throw new Error("INVALID_SETTINGS_ORIGIN");
  app.get(
    ["/api/v1/laboratory-settings", "/api/v1/laboratory-settings/history"],
    async (req, res) => {
      const history = req.path.endsWith("/history"),
        raw = req.query.before;
      const before =
        typeof raw === "string" && /^[1-9][0-9]*$/.test(raw)
          ? RevisionSchema.safeParse(Number(raw))
          : null;
      if (
        Object.keys(req.query).some((k) => !history || k !== "before") ||
        (raw !== undefined && !before?.success)
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
      const result = history
        ? await services.service.history(
            actor,
            before?.success ? before.data : undefined,
          )
        : await services.service.read(actor);
      if (!result) {
        sendProblem(res, "FORBIDDEN", 403);
        return;
      }
      res.json(result);
    },
  );
  app.put("/api/v1/laboratory-settings", async (req, res) => {
    if (!mutationOriginAllowed(req.headers.origin, services.origin)) {
      sendProblem(res, "FORBIDDEN", 403);
      return;
    }
    const command = LaboratoryUpdateSchema.safeParse(req.body);
    if (
      !req.is("application/json") ||
      Object.keys(req.query).length ||
      !command.success
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
    const result = LaboratoryMutationResultSchema.parse(
      await services.service.update(actor, command.data),
    );
    res
      .status(
        result.kind === "applied"
          ? 200
          : result.kind === "denied"
            ? 403
            : result.kind === "invalid"
              ? 400
              : 409,
      )
      .json(result);
  });
}
