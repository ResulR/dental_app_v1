import type { Express } from "express";
import { createApplicationDatabase } from "../shared/database.js";
import { readAuthConfig } from "./auth-config.js";
import {
  assertAuthStorageReady,
  createAuthenticationService,
  createIdentityRepository,
  createPersistentLoginLimiter,
  createSessionRepository,
  createSessionService,
  registerAuthenticationRoutes,
} from "../modules/identity/index.js";

export async function createRuntime(env: NodeJS.ProcessEnv) {
  const config = readAuthConfig(env);
  if (!config) return { registerRoutes: undefined, close: async () => {} };
  const database = createApplicationDatabase(env);
  try {
    // Fail startup, without creating/migrating anything, if required objects or
    // read privileges are absent. Every checkout also enforces runtime identity.
    await assertAuthStorageReady(database);
    const repository = createIdentityRepository(database);
    const limiter = createPersistentLoginLimiter(database, config.loginLimit);
    const authentication = createAuthenticationService({
      findCredential: repository.findCredential,
      admit: limiter.consume,
    });
    const sessions = createSessionService(
      createSessionRepository(database),
      config.session,
    );
    return {
      registerRoutes: (app: Express) =>
        registerAuthenticationRoutes(app, {
          authentication,
          sessions,
          origin: config.origin,
        }),
      close: () => database.close(),
    };
  } catch (error) {
    await database.close();
    throw error;
  }
}
