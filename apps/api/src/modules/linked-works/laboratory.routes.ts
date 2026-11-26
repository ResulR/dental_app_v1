import type { Express } from "express";
import {
  LaboratoryLinkedWorkSchema,
  LaboratoryClinicOrderSchema,
  LaboratoryClinicListQuerySchema,
} from "@dental-lab/contracts";
import { readSessionCookie, mutationOriginAllowed } from "../identity/index.js";
import type { createSessionService } from "../identity/index.js";
import type { createLaboratoryLinkedWorkService } from "./laboratory.service.js";
import { sendProblem } from "../../shared/problems.js";
export function registerLaboratoryLinkedWorkRoutes(
  app: Express,
  services: {
    service: ReturnType<typeof createLaboratoryLinkedWorkService>;
    sessions: Pick<ReturnType<typeof createSessionService>, "authenticate">;
    origin: string;
    linked?: boolean;
    standalone?: boolean;
  },
) {
  if (!mutationOriginAllowed(services.origin, services.origin))
    throw new Error("INVALID_SUBMISSION_ORIGIN");
  if (services.linked !== false)
    app.post("/api/v1/orders/laboratory-linked", async (req, res) => {
      if (!mutationOriginAllowed(req.headers.origin, services.origin)) {
        sendProblem(res, "FORBIDDEN", 403);
        return;
      }
      const input = LaboratoryLinkedWorkSchema.safeParse(req.body);
      if (
        !req.is("application/json") ||
        Object.keys(req.query).length ||
        !input.success
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
      const checked = await services.service.submit(actor, input.data);
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
  if (services.standalone) {
    app.get("/api/v1/orders/laboratory-clinics", async (req, res) => {
      const parsed = LaboratoryClinicListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        sendProblem(res, "VALIDATION_FAILED", 400);
        return;
      }
      const token = readSessionCookie(req.headers.cookie);
      const actor = token ? await services.sessions.authenticate(token) : null;
      if (!actor) {
        sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
        return;
      }
      const page = await services.service.clinics(actor, parsed.data.after);
      if (!page) {
        sendProblem(res, "FORBIDDEN", 403);
        return;
      }
      res.json(page);
    });
    app.post("/api/v1/orders/laboratory-clinic", async (req, res) => {
      if (!mutationOriginAllowed(req.headers.origin, services.origin)) {
        sendProblem(res, "FORBIDDEN", 403);
        return;
      }
      const parsed = LaboratoryClinicOrderSchema.safeParse(req.body);
      if (
        !req.is("application/json") ||
        Object.keys(req.query).length ||
        !parsed.success
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
      const checked = await services.service.submitStandalone(
        actor,
        parsed.data,
      );
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
}
