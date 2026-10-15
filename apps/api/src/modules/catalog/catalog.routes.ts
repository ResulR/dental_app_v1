import type { Express } from "express";
import {
  CatalogKindSchema,
  ClinicIdSchema,
  ActiveCatalogPageSchema,
} from "@dental-lab/contracts";
import { sendProblem } from "../../shared/problems.js";
import type { createCatalogService } from "./catalog.service.js";
export function registerCatalogRoutes(
  app: Express,
  services: {
    service: ReturnType<typeof createCatalogService>;
    authenticate: (
      cookie: string | undefined,
    ) => Promise<{ accountId: string; sessionId: string } | null>;
  },
) {
  app.get("/api/v1/catalog/:kind", async (req, res) => {
    const kind = CatalogKindSchema.safeParse(req.params.kind);
    if (
      !kind.success ||
      Object.keys(req.query).some((key) => key !== "after") ||
      (req.query.after !== undefined &&
        !ClinicIdSchema.safeParse(req.query.after).success)
    ) {
      sendProblem(res, "VALIDATION_FAILED", 400);
      return;
    }
    const actor = await services.authenticate(req.headers.cookie);
    if (!actor) {
      sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
      return;
    }
    const result = await services.service.list(
      actor,
      kind.data,
      req.query.after,
    );
    if (!result) {
      sendProblem(res, "FORBIDDEN", 403);
      return;
    }
    res.json(ActiveCatalogPageSchema.parse(result));
  });
}
