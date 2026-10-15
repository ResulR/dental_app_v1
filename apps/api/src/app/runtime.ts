import { delegationEnabled } from "./delegation-config.js";
import {
  assertDelegationStorageReady,
  createDelegationRuntimeService,
  registerDelegationRoutes,
} from "../modules/permissions/index.js";
import { createCurrentPermissionsRepository } from "../modules/permissions/index.js";
import { clinicManagementEnabled } from "./clinic-management-config.js";
import {
  registerClinicManagementRoutes,
  assertClinicManagementStorageReady,
} from "../modules/clinics/index.js";
import { registrationEnabled } from "./registration-config.js";
import {
  assertRegistrationStorageReady,
  createRegistrationTermsRepository,
  createClinicRegistrationRepository,
  createClinicRegistrationService,
  registerClinicRegistrationRoutes,
} from "../modules/clinics/index.js";
import type { Express } from "express";
import { createApplicationDatabase } from "../shared/database.js";
import { readAuthConfig } from "./auth-config.js";
import {
  readSessionCookie,
  mutationOriginAllowed,
  assertAuthStorageReady,
  createAuthenticationService,
  createIdentityRepository,
  createPersistentLoginLimiter,
  createSessionRepository,
  createSessionService,
  registerAuthenticationRoutes,
} from "../modules/identity/index.js";

export async function createRuntime(env: NodeJS.ProcessEnv) {
  const enableDelegation = delegationEnabled(env);
  const enableClinicManagement = clinicManagementEnabled(env);
  const enableRegistration = registrationEnabled(env);
  const config = readAuthConfig(env);
  if (!config) return { registerRoutes: undefined, close: async () => {} };
  const database = createApplicationDatabase(env);
  try {
    // Fail startup, without creating/migrating anything, if required objects or
    // read privileges are absent. Every checkout also enforces runtime identity.
    await assertAuthStorageReady(database);
    if (enableDelegation) await assertDelegationStorageReady(database);
    if (enableClinicManagement)
      await assertClinicManagementStorageReady(database);
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
    let registration:
      ReturnType<typeof createClinicRegistrationService> | undefined;
    const terms = createRegistrationTermsRepository(database);
    if (enableRegistration) {
      await assertRegistrationStorageReady(database);
      const store = createClinicRegistrationRepository(database);
      registration = createClinicRegistrationService({
        currentTermsVersion: async () => (await terms.current())?.version_id,
        ownerInitialized: store.ownerInitialized,
        registerAtomic: store.registerAtomic,
        // Explicitly shares the existing account/network budget with login.
        // A second endpoint must not create a way around the persistent limiter.
        admit: limiter.consume,
      });
    }
    return {
      registerRoutes: (app: Express) => {
        registerAuthenticationRoutes(app, {
          currentPermissions:
            createCurrentPermissionsRepository(database).current,
          authentication,
          sessions,
          origin: config.origin,
        });
        if (enableDelegation)
          registerDelegationRoutes(app, {
            service: createDelegationRuntimeService(database),
            authenticate: async (cookie) => {
              const token = readSessionCookie(cookie);
              return token ? sessions.authenticate(token) : null;
            },
            originAllowed: (origin) =>
              mutationOriginAllowed(origin, config.origin),
          });
        if (enableClinicManagement)
          registerClinicManagementRoutes(app, {
            sessions,
            database,
            origin: config.origin,
          });
        if (registration)
          registerClinicRegistrationRoutes(app, {
            registration,
            terms: terms.current,
            origin: config.origin,
          });
      },
      close: () => database.close(),
    };
  } catch (error) {
    await database.close();
    throw error;
  }
}
