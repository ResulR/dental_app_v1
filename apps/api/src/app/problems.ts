import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
type ProblemCode =
  "VALIDATION_FAILED" | "RESOURCE_NOT_FOUND" | "INTERNAL_ERROR";
const titles: Record<ProblemCode, string> = {
  VALIDATION_FAILED: "Kërkesa nuk është e vlefshme.",
  RESOURCE_NOT_FOUND: "Burimi nuk u gjet.",
  INTERNAL_ERROR: "Ndodhi një gabim. Ju lutemi provoni përsëri.",
};
export function sendProblem(res: Response, code: ProblemCode, status: number) {
  const requestId: string =
    typeof res.locals.requestId === "string"
      ? res.locals.requestId
      : randomUUID();
  res
    .status(status)
    .type("application/problem+json")
    .json({
      type: "/api/v1/problems/" + code.toLowerCase(),
      title: titles[code],
      status,
      code,
      request_id: requestId,
    });
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
