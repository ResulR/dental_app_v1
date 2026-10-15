import type { Express, Request, Response } from "express";
import {
  ClinicIdSchema,
  DelegationCommandSchema,
  DelegationKindSchema,
  DelegationResultSchema,
  RevisionSchema,
} from "@dental-lab/contracts";
import { sendProblem } from "../../shared/problems.js";
import type { createDelegationRuntimeService } from "./delegation-runtime.service.js";
type Actor = { accountId: string; sessionId: string };
export function registerDelegationRoutes(
  app: Express,
  services: {
    service: ReturnType<typeof createDelegationRuntimeService>;
    authenticate: (cookie: string | undefined) => Promise<Actor | null>;
    originAllowed: (origin: unknown) => boolean;
  },
) {
  async function actor(req: Request, res: Response) {
    const result = await services.authenticate(req.headers.cookie);
    if (!result) sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
    return result;
  }
  function parameters(req: Request, res: Response, target = false) {
    const kind = DelegationKindSchema.safeParse(req.params.kind);
    if (
      !kind.success ||
      (target && !ClinicIdSchema.safeParse(req.params.id).success)
    ) {
      sendProblem(res, "VALIDATION_FAILED", 400);
      return null;
    }
    return kind.data;
  }
  app.get("/api/v1/delegation/:kind", async (req, res) => {
    const kind = parameters(req, res);
    if (!kind) return;
    if (
      Object.keys(req.query).some((k) => k !== "after") ||
      (req.query.after !== undefined &&
        !ClinicIdSchema.safeParse(req.query.after).success)
    ) {
      sendProblem(res, "VALIDATION_FAILED", 400);
      return;
    }
    const who = await actor(req, res);
    if (!who) return;
    const result = await services.service.list(
      who,
      kind,
      req.query.after as string | undefined,
    );
    if (!result) {
      sendProblem(res, "FORBIDDEN", 403);
      return;
    }
    res.json(result);
  });
  app.get("/api/v1/delegation/:kind/:id", async (req, res) => {
    const kind = parameters(req, res, true);
    if (!kind) return;
    if (Object.keys(req.query).length) {
      sendProblem(res, "VALIDATION_FAILED", 400);
      return;
    }
    const who = await actor(req, res);
    if (!who) return;
    const result = await services.service.profile(
      who,
      kind,
      req.params.id as string,
    );
    if (!result) {
      sendProblem(res, "FORBIDDEN", 403);
      return;
    }
    res.json(result);
  });
  app.get("/api/v1/delegation/:kind/:id/history", async (req, res) => {
    const kind = parameters(req, res, true);
    if (!kind) return;
    const raw = req.query.before;
    const before =
      typeof raw === "string" && /^[1-9][0-9]*$/.test(raw)
        ? RevisionSchema.safeParse(Number(raw))
        : null;
    if (
      Object.keys(req.query).some((k) => k !== "before") ||
      (raw !== undefined && !before?.success)
    ) {
      sendProblem(res, "VALIDATION_FAILED", 400);
      return;
    }
    const who = await actor(req, res);
    if (!who) return;
    const result = await services.service.history(
      who,
      kind,
      req.params.id as string,
      before?.success ? before.data : undefined,
    );
    if (!result) {
      sendProblem(res, "FORBIDDEN", 403);
      return;
    }
    res.json(result);
  });
  app.put("/api/v1/delegation/:kind/:id", async (req, res) => {
    if (!services.originAllowed(req.headers.origin)) {
      sendProblem(res, "FORBIDDEN", 403);
      return;
    }
    const kind = parameters(req, res, true);
    if (!kind) return;
    const command = DelegationCommandSchema.safeParse(req.body);
    if (
      !req.is("application/json") ||
      Object.keys(req.query).length ||
      !command.success
    ) {
      sendProblem(res, "VALIDATION_FAILED", 400);
      return;
    }
    const who = await actor(req, res);
    if (!who) return;
    const result = DelegationResultSchema.parse(
      await services.service.change(
        who,
        kind,
        req.params.id as string,
        command.data,
      ),
    );
    res
      .status(
        result.kind === "applied" || result.kind === "confirmation_required"
          ? 200
          : result.kind === "conflict"
            ? 409
            : result.kind === "denied"
              ? 403
              : 400,
      )
      .json(result);
  });
}
