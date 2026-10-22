import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
type ProblemCode =
  | "VALIDATION_FAILED"
  | "RESOURCE_NOT_FOUND"
  | "INTERNAL_ERROR"
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "DEPENDENCY_UNAVAILABLE"
  | "STATE_CONFLICT";
import { ProblemSchema } from "@dental-lab/contracts";
import type { FieldIssue } from "@dental-lab/contracts";
const titles: Record<ProblemCode, string> = {
  DEPENDENCY_UNAVAILABLE: "Shërbimi nuk është i disponueshëm për momentin.",
  STATE_CONFLICT: "Regjistrimi nuk mund të përfundohet me këto të dhëna.",
  AUTHENTICATION_REQUIRED: "Identifikimi nuk u pranua.",
  FORBIDDEN: "Kjo kërkesë nuk lejohet.",
  RATE_LIMITED: "Shumë përpjekje. Ju lutemi provoni më vonë.",
  VALIDATION_FAILED: "Kërkesa nuk është e vlefshme.",
  RESOURCE_NOT_FOUND: "Burimi nuk u gjet.",
  INTERNAL_ERROR: "Ndodhi një gabim. Ju lutemi provoni përsëri.",
};
export function sendProblem(
  res: Response,
  code: ProblemCode,
  status: number,
  errors?: FieldIssue[],
) {
  const requestId: string =
    typeof res.locals.requestId === "string"
      ? res.locals.requestId
      : randomUUID();
  res
    .status(status)
    .type("application/problem+json")
    .json(
      ProblemSchema.parse({
        type: "/api/v1/problems/" + code.toLowerCase(),
        title: titles[code],
        status,
        code,
        request_id: requestId,
        ...(errors === undefined ? {} : { errors }),
      }),
    );
}
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  // Express requires four parameters to identify an error middleware.
  void _next;
  if (res.headersSent) {
    res.destroy();
    return;
  }
  const type =
    error !== null && typeof error === "object" && "type" in error
      ? error.type
      : undefined;
  if (type === "entity.parse.failed") {
    sendProblem(res, "VALIDATION_FAILED", 400);
    return;
  }
  if (type === "entity.too.large") {
    sendProblem(res, "VALIDATION_FAILED", 413);
    return;
  }
  sendProblem(res, "INTERNAL_ERROR", 500);
}
