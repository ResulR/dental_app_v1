import type { Express, Request, Response } from "express";
import {
  EffectivePermissionsSchema,
  LoginRequestSchema,
  EmptyAuthMutationSchema,
  SessionIdentitySchema,
  parseContract,
} from "@dental-lab/contracts";
import { sendProblem } from "../../shared/problems.js";
import type { createAuthenticationService } from "./authentication.service.js";
import type { createSessionService } from "./sessions.js";
import {
  readSessionCookie,
  mutationOriginAllowed,
  clearSessionCookie,
} from "./sessions.js";

type Services = {
  authentication: ReturnType<typeof createAuthenticationService>;
  sessions: ReturnType<typeof createSessionService>;
  origin: string;
  currentPermissions?: (actor: {
    accountId: string;
    sessionId: string;
  }) => Promise<unknown | null>;
};
export function registerAuthenticationRoutes(
  app: Express,
  services: Services,
): void {
  if (!mutationOriginAllowed(services.origin, services.origin))
    throw new Error("INVALID_AUTH_ORIGIN");
  function mutation(req: Request, res: Response): boolean {
    if (!mutationOriginAllowed(req.headers.origin, services.origin)) {
      sendProblem(res, "FORBIDDEN", 403);
      return false;
    }
    if (!req.is("application/json") || Object.keys(req.query).length !== 0) {
      sendProblem(res, "VALIDATION_FAILED", 400);
      return false;
    }
    return true;
  }
  function empty(req: Request, res: Response): boolean {
    if (!mutation(req, res)) return false;
    if (!EmptyAuthMutationSchema.safeParse(req.body).success) {
      sendProblem(res, "VALIDATION_FAILED", 400);
      return false;
    }
    return true;
  }
  app.post("/api/v1/auth/login", async (req, res) => {
    if (!mutation(req, res)) return;
    const parsed = parseContract(LoginRequestSchema, req.body);
    if (!parsed.success) {
      sendProblem(res, "VALIDATION_FAILED", 400, parsed.errors);
      return;
    }
    // trust proxy stays false. Forwarded headers never choose the limiter key.
    const network = req.socket.remoteAddress;
    if (!network) {
      sendProblem(res, "INTERNAL_ERROR", 500);
      return;
    }
    const result = await services.authentication.authenticate(
      parsed.data.email,
      parsed.data.password,
      network,
    );
    if (result.kind === "limited") {
      res.setHeader("Retry-After", String(result.retryAfterSeconds));
      sendProblem(res, "RATE_LIMITED", 429);
      return;
    }
    if (result.kind === "denied") {
      sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
      return;
    }
    const session = await services.sessions.issue(result);
    if (!session) {
      sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
      return;
    }
    res.setHeader("Set-Cookie", session.setCookie);
    res.status(204).end();
  });
  app.get("/api/v1/auth/session", async (req, res) => {
    if (Object.keys(req.query).length !== 0) {
      sendProblem(res, "VALIDATION_FAILED", 400);
      return;
    }
    const token = readSessionCookie(req.headers.cookie);
    const identity = token ? await services.sessions.authenticate(token) : null;
    if (!identity) {
      sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
      return;
    }
    res.json(
      SessionIdentitySchema.parse({
        account_id: identity.accountId,
        profile: identity.profile,
      }),
    );
  });
  if (services.currentPermissions)
    app.get("/api/v1/auth/permissions", async (req, res) => {
      if (Object.keys(req.query).length !== 0) {
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
      const current = await services.currentPermissions!(identity);
      if (!current) {
        sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
        return;
      }
      const snapshot = EffectivePermissionsSchema.parse(current);
      if (
        snapshot.account_id !== identity.accountId ||
        snapshot.profile !== identity.profile
      )
        throw new Error("PERMISSION_IDENTITY_MISMATCH");
      res.json(snapshot);
    });
  app.post("/api/v1/auth/renew", async (req, res) => {
    if (!empty(req, res)) return;
    const token = readSessionCookie(req.headers.cookie);
    const renewed = token ? await services.sessions.renew(token) : null;
    if (!renewed) {
      sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
      return;
    }
    if (renewed.kind === "renewed")
      res.setHeader("Set-Cookie", renewed.setCookie);
    res.status(204).end();
  });
  app.post("/api/v1/auth/logout", async (req, res) => {
    if (!empty(req, res)) return;
    const token = readSessionCookie(req.headers.cookie);
    const cookie = token
      ? await services.sessions.logout(token)
      : clearSessionCookie();
    res.setHeader("Set-Cookie", cookie);
    res.status(204).end();
  });
  app.post("/api/v1/auth/logout-all", async (req, res) => {
    if (!empty(req, res)) return;
    const token = readSessionCookie(req.headers.cookie);
    const identity = token ? await services.sessions.authenticate(token) : null;
    if (!identity) {
      sendProblem(res, "AUTHENTICATION_REQUIRED", 401);
      return;
    }
    await services.sessions.revokeAllForAccount(identity.accountId);
    res.setHeader("Set-Cookie", clearSessionCookie());
    res.status(204).end();
  });
}
