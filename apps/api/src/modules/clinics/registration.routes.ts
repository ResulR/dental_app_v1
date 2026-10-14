import type { Express } from "express";
import { ClinicRegistrationReceiptSchema } from "@dental-lab/contracts";
import { mutationOriginAllowed } from "../identity/index.js";
import { sendProblem } from "../../shared/problems.js";
import type { createClinicRegistrationService } from "./registration.service.js";

// Explicit composition only: runtime must not enable registration until the
// approved terms, transactional storage and durable notification are available.
export function registerClinicRegistrationRoutes(
  app: Express,
  services: {
    registration: ReturnType<typeof createClinicRegistrationService>;
    origin: string;
  },
): void {
  if (!mutationOriginAllowed(services.origin, services.origin))
    throw new Error("INVALID_REGISTRATION_ORIGIN");
  app.post("/api/v1/clinics/registration", async (req, res) => {
    if (!mutationOriginAllowed(req.headers.origin, services.origin)) {
      sendProblem(res, "FORBIDDEN", 403);
      return;
    }
    if (!req.is("application/json") || Object.keys(req.query).length !== 0) {
      sendProblem(res, "VALIDATION_FAILED", 400);
      return;
    }
    const network = req.socket.remoteAddress;
    if (!network) {
      sendProblem(res, "INTERNAL_ERROR", 500);
      return;
    }
    // Service validates even malformed payloads after admission. Never trust
    // forwarded headers, issue a session, or echo submitted personal data.
    const result = await services.registration.register(req.body, network);
    switch (result.kind) {
      case "pending":
        res.status(201).json(ClinicRegistrationReceiptSchema.parse(result));
        return;
      case "invalid":
        sendProblem(
          res,
          "VALIDATION_FAILED",
          400,
          result.fields.map((pointer) => ({ pointer, code: "INVALID_VALUE" })),
        );
        return;
      case "limited":
        res.setHeader("Retry-After", String(result.retryAfterSeconds));
        sendProblem(res, "RATE_LIMITED", 429);
        return;
      case "unavailable":
        sendProblem(res, "DEPENDENCY_UNAVAILABLE", 503);
        return;
      case "conflict":
        sendProblem(res, "STATE_CONFLICT", 409);
    }
  });
}
