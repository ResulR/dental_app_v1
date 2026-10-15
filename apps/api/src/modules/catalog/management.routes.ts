import type { Express } from "express";
import {
  ClinicIdSchema,
  CatalogEditSchema,
  CatalogMutationResultSchema,
  RevisionSchema,
} from "@dental-lab/contracts";
import { sendProblem } from "../../shared/problems.js";
import { readSessionCookie, mutationOriginAllowed } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import type { createCatalogManagementService } from "./management.service.js";
export function registerCatalogManagementRoutes(
  app: Express,
  services: {
    service: ReturnType<typeof createCatalogManagementService>;
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
    origin: string;
  },
) {
  if (!mutationOriginAllowed(services.origin, services.origin))
    throw new Error("INVALID_ACCOUNT_STATE_ORIGIN");
  app.get("/api/v1/catalog-management", async (req, res) => {
    const after = req.query.after;
    if (
      Object.keys(req.query).some((k) => k !== "after") ||
      (after !== undefined && !ClinicIdSchema.safeParse(after).success)
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
    const result = await services.service.list(
      actor,
      after as string | undefined,
    );
    if (!result) {
      sendProblem(res, "FORBIDDEN", 403);
      return;
    }
    res.json(result);
  });
  app.get(
    [
      "/api/v1/catalog-management/:id",
      "/api/v1/catalog-management/:id/history",
    ],
    async (req, res) => {
      const history = req.path.endsWith("/history"),
        raw = req.query.before;
      const before =
        typeof raw === "string" && /^[1-9][0-9]*$/.test(raw)
          ? RevisionSchema.safeParse(Number(raw))
          : null;
      if (
        !ClinicIdSchema.safeParse(req.params.id).success ||
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
            req.params.id as string,
            before?.success ? before.data : undefined,
          )
        : await services.service.profile(actor, req.params.id as string);
      if (!result) {
        sendProblem(res, "FORBIDDEN", 403);
        return;
      }
      res.json(result);
    },
  );
  app.get("/api/v1/catalog-management/:id/impacts", async (req, res) => {
    if (
      !ClinicIdSchema.safeParse(req.params.id).success ||
      Object.keys(req.query).some((k) => k !== "after") ||
      (req.query.after !== undefined &&
        !ClinicIdSchema.safeParse(req.query.after).success)
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
    const result = await services.service.impacts(
      actor,
      req.params.id as string,
      req.query.after as string | undefined,
    );
    if (!result) {
      sendProblem(res, "FORBIDDEN", 403);
      return;
    }
    res.json(result);
  });
  app.post("/api/v1/catalog-management", async (req, res) => {
    if (!mutationOriginAllowed(req.headers.origin, services.origin)) {
      sendProblem(res, "FORBIDDEN", 403);
      return;
    }
    if (!req.is("application/json") || Object.keys(req.query).length) {
      sendProblem(res, "VALIDATION_FAILED", 400);
      return;
    }
    const token = readSessionCookie(req.headers.cookie),
      actor = token ? await services.sessions.authenticate(token) : null;
    if (!actor) {
      sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
      return;
    }
    const result = CatalogMutationResultSchema.parse(
      await services.service.create(actor, req.body),
    );
    res
      .status(
        result.kind === "applied" ? 201 : result.kind === "denied" ? 403 : 400,
      )
      .json(result);
  });
  app.put("/api/v1/catalog-management/:id", async (req, res) => {
    if (!mutationOriginAllowed(req.headers.origin, services.origin)) {
      sendProblem(res, "FORBIDDEN", 403);
      return;
    }
    const command = CatalogEditSchema.safeParse(req.body);
    if (
      !ClinicIdSchema.safeParse(req.params.id).success ||
      Object.keys(req.query).length ||
      !req.is("application/json") ||
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
    const result = CatalogMutationResultSchema.parse(
      await services.service.change(
        actor,
        req.params.id as string,
        command.data,
      ),
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
