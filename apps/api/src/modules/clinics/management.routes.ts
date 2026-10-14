import type { Express } from "express";
import {
  ObjectIdSchema,
  ClinicContactUpdateSchema,
  RevisionSchema,
  ClinicReviewRequestSchema,
} from "@dental-lab/contracts";
import { readSessionCookie, mutationOriginAllowed } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import type { createApplicationDatabase } from "../../shared/database.js";
import { sendProblem } from "../../shared/problems.js";
import { createClinicManagementService } from "./management.service.js";
export function registerClinicManagementRoutes(
  app: Express,
  services: {
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
    database: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">;
    origin: string;
  },
) {
  if (!mutationOriginAllowed(services.origin, services.origin))
    throw new Error("INVALID_CLINIC_ORIGIN");
  app.get(
    ["/api/v1/clinics/self/profile", "/api/v1/clinics/:id/profile"],
    async (req, res) => {
      if (Object.keys(req.query).length) {
        sendProblem(res, "VALIDATION_FAILED", 400);
        return;
      }
      const id = req.params.id;
      if (id !== undefined && !ObjectIdSchema.safeParse(id).success) {
        sendProblem(res, "VALIDATION_FAILED", 400);
        return;
      }
      const token = readSessionCookie(req.headers.cookie);
      const identity = token
        ? await services.sessions.authenticate(token)
        : null;
      if (!identity) {
        sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
        return;
      }
      const profile = await createClinicManagementService(
        services.database,
        identity,
      ).readProfile(id as string | undefined);
      if (!profile) {
        sendProblem(res, "FORBIDDEN", 403);
        return;
      }
      res.json(profile);
    },
  );
  app.get("/api/v1/clinics/:id/profile/history", async (req, res) => {
    const before = req.query.before;
    const parsed =
      typeof before === "string" && /^[1-9][0-9]*$/.test(before)
        ? RevisionSchema.safeParse(Number(before))
        : null;
    if (
      !ObjectIdSchema.safeParse(req.params.id).success ||
      Object.keys(req.query).some((k) => k !== "before") ||
      (before !== undefined && (!parsed?.success || parsed.data < 1))
    ) {
      sendProblem(res, "VALIDATION_FAILED", 400);
      return;
    }
    const token = readSessionCookie(req.headers.cookie);
    const identity = token ? await services.sessions.authenticate(token) : null;
    if (!identity) {
      sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
      return;
    }
    const history = await createClinicManagementService(
      services.database,
      identity,
    ).contactHistory(
      req.params.id as string,
      parsed?.success ? parsed.data : undefined,
    );
    if (!history) {
      sendProblem(res, "FORBIDDEN", 403);
      return;
    }
    res.json(history);
  });
  app.put("/api/v1/clinics/:id/profile", async (req, res) => {
    if (!mutationOriginAllowed(req.headers.origin, services.origin)) {
      sendProblem(res, "FORBIDDEN", 403);
      return;
    }
    const parsed = ClinicContactUpdateSchema.safeParse(req.body);
    if (
      !ObjectIdSchema.safeParse(req.params.id).success ||
      Object.keys(req.query).length ||
      !req.is("application/json") ||
      !parsed.success
    ) {
      sendProblem(res, "VALIDATION_FAILED", 400);
      return;
    }
    const token = readSessionCookie(req.headers.cookie);
    const identity = token ? await services.sessions.authenticate(token) : null;
    if (!identity) {
      sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
      return;
    }
    const result = await createClinicManagementService(
      services.database,
      identity,
    ).updateProfile(req.params.id as string, parsed.data);
    if (result.kind === "applied") {
      res.status(204).end();
      return;
    }
    sendProblem(
      res,
      result.kind === "denied"
        ? "FORBIDDEN"
        : result.kind === "conflict"
          ? "STATE_CONFLICT"
          : "VALIDATION_FAILED",
      result.kind === "denied" ? 403 : result.kind === "conflict" ? 409 : 400,
    );
  });
  app.get("/api/v1/clinics/pending", async (req, res) => {
    const after = req.query.after;
    if (
      Object.keys(req.query).some((k) => k !== "after") ||
      (after !== undefined && !ObjectIdSchema.safeParse(after).success)
    ) {
      sendProblem(res, "VALIDATION_FAILED", 400);
      return;
    }
    const token = readSessionCookie(req.headers.cookie);
    const identity = token ? await services.sessions.authenticate(token) : null;
    if (!identity) {
      sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
      return;
    }
    const queue = await createClinicManagementService(
      services.database,
      identity,
    ).pending(after as string | undefined);
    if (!queue) {
      sendProblem(res, "FORBIDDEN", 403);
      return;
    }
    res.json(queue);
  });
  app.post("/api/v1/clinics/:id/review", async (req, res) => {
    if (!mutationOriginAllowed(req.headers.origin, services.origin)) {
      sendProblem(res, "FORBIDDEN", 403);
      return;
    }
    const parsed = ClinicReviewRequestSchema.safeParse(req.body);
    if (
      !req.is("application/json") ||
      Object.keys(req.query).length ||
      !ObjectIdSchema.safeParse(req.params.id).success ||
      !parsed.success
    ) {
      sendProblem(res, "VALIDATION_FAILED", 400);
      return;
    }
    const token = readSessionCookie(req.headers.cookie);
    const identity = token ? await services.sessions.authenticate(token) : null;
    if (!identity) {
      sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
      return;
    }
    const store = createClinicManagementService(services.database, identity);
    const result = await store.decide({
      clinicId: req.params.id as string,
      expectedRevision: parsed.data.expected_revision,
      decision: parsed.data.decision,
      ...(parsed.data.reason !== undefined
        ? { reason: parsed.data.reason }
        : {}),
    });
    if (result.kind === "applied") {
      res.status(204).end();
      return;
    }
    sendProblem(
      res,
      result.kind === "denied"
        ? "FORBIDDEN"
        : result.kind === "conflict"
          ? "STATE_CONFLICT"
          : "VALIDATION_FAILED",
      result.kind === "denied" ? 403 : result.kind === "conflict" ? 409 : 400,
    );
  });
}
