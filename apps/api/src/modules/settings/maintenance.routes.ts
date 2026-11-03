import type { Express } from "express";
import { readSessionCookie, mutationOriginAllowed } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import type { createMaintenanceStateRepository } from "./maintenance-state.repository.js";
import { sendProblem } from "../../shared/problems.js";

export function registerMaintenanceRoutes(
  app: Express,
  services: {
    repository: ReturnType<typeof createMaintenanceStateRepository>;
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
    origin: string;
  },
) {
  app.get("/api/v1/maintenance/state", async (req, res) => {
    if (Object.keys(req.query).length)
      return sendProblem(res, "VALIDATION_FAILED", 400);
    const token = readSessionCookie(req.headers.cookie);
    const actor = token ? await services.sessions.authenticate(token) : null;
    if (!actor) return sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
    const state = await services.repository.read(actor);
    if (!state) return sendProblem(res, "FORBIDDEN", 403);
    res.json(state);
  });
  app.get("/api/v1/maintenance/history", async (req, res) => {
    if (Object.keys(req.query).length)
      return sendProblem(res, "VALIDATION_FAILED", 400);
    const token = readSessionCookie(req.headers.cookie);
    const actor = token ? await services.sessions.authenticate(token) : null;
    if (!actor) return sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
    const history = await services.repository.history(actor);
    if (!history) return sendProblem(res, "FORBIDDEN", 403);
    res.json({ items: history });
  });
  app.put("/api/v1/maintenance/state", async (req, res) => {
    if (!mutationOriginAllowed(req.headers.origin, services.origin))
      return sendProblem(res, "FORBIDDEN", 403);
    if (!req.is("application/json") || Object.keys(req.query).length)
      return sendProblem(res, "VALIDATION_FAILED", 400);
    const token = readSessionCookie(req.headers.cookie);
    const actor = token ? await services.sessions.authenticate(token) : null;
    if (!actor) return sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
    const result = await services.repository.update(actor, req.body);
    res
      .status(
        result.kind === "denied"
          ? 403
          : result.kind === "invalid"
            ? 400
            : result.kind === "conflict"
              ? 409
              : 200,
      )
      .json(result);
  });
}
