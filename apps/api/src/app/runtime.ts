import { orderDecisionEnabled } from "./order-decision-config.js";
import {
  assertOrderDecisionReady,
  createOrderDecisionService,
  registerOrderDecisionRoutes,
} from "../modules/orders/index.js";
import { orderSubmissionEnabled } from "./order-submission-config.js";
import {
  assertOrderSubmissionReady,
  createOrderSubmissionService,
  registerOrderSubmissionRoutes,
} from "../modules/orders/index.js";
import { orderPreflightEnabled } from "./order-preflight-config.js";
import {
  createOrderPreflightService,
  registerOrderPreflightRoutes,
} from "../modules/orders/index.js";
import { laboratorySettingsEnabled } from "./laboratory-settings-config.js";
import {
  assertLaboratorySettingsReady,
  createLaboratorySettingsService,
  registerLaboratorySettingsRoutes,
} from "../modules/settings/index.js";
import { catalogManagementEnabled } from "./catalog-management-config.js";
import {
  assertCatalogManagementReady,
  createCatalogManagementService,
  registerCatalogManagementRoutes,
} from "../modules/catalog/index.js";
import { catalogEnabled } from "./catalog-config.js";
import {
  assertCatalogStorageReady,
  createCatalogService,
  registerCatalogRoutes,
} from "../modules/catalog/index.js";
import { adminManagementEnabled } from "./admin-management-config.js";
import {
  assertAdminStorageReady,
  createAdminRuntimeService,
  registerAdminRoutes,
} from "../modules/identity/index.js";
import { accountStateEnabled } from "./account-state-config.js";
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
  assertAccountStateStorageReady,
  createAccountStateRuntimeService,
  registerAccountStateRoutes,
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
  const enableOrderDecision = orderDecisionEnabled(env);
  const enableOrderSubmission = orderSubmissionEnabled(env);
  const enableOrderPreflight = orderPreflightEnabled(env);
  const enableLaboratorySettings = laboratorySettingsEnabled(env);
  const enableCatalogManagement = catalogManagementEnabled(env);
  const enableCatalog = catalogEnabled(env);
  const enableAdminManagement = adminManagementEnabled(env);
  const enableAccountState = accountStateEnabled(env);
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
    if (enableLaboratorySettings) await assertLaboratorySettingsReady(database);
    if (enableCatalogManagement) await assertCatalogManagementReady(database);
    if (enableCatalog) await assertCatalogStorageReady(database);
    if (enableOrderSubmission) await assertOrderSubmissionReady(database);
    if (enableOrderDecision) await assertOrderDecisionReady(database);
    if (enableAdminManagement) await assertAdminStorageReady(database);
    if (enableAccountState) await assertAccountStateStorageReady(database);
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
        if (enableLaboratorySettings)
          registerLaboratorySettingsRoutes(app, {
            service: createLaboratorySettingsService(database),
            sessions,
            origin: config.origin,
          });
        if (enableOrderDecision)
          registerOrderDecisionRoutes(app, {
            service: createOrderDecisionService(database),
            sessions,
            origin: config.origin,
          });
        if (enableOrderSubmission)
          registerOrderSubmissionRoutes(app, {
            service: createOrderSubmissionService(database),
            sessions,
            origin: config.origin,
          });
        if (enableOrderPreflight)
          registerOrderPreflightRoutes(app, {
            service: createOrderPreflightService(database),
            sessions,
            origin: config.origin,
          });
        if (enableCatalogManagement)
          registerCatalogManagementRoutes(app, {
            service: createCatalogManagementService(database),
            sessions,
            origin: config.origin,
          });
        if (enableCatalog)
          registerCatalogRoutes(app, {
            service: createCatalogService(database),
            authenticate: async (cookie) => {
              const token = readSessionCookie(cookie);
              return token ? sessions.authenticate(token) : null;
            },
          });
        if (enableAdminManagement)
          registerAdminRoutes(app, {
            service: createAdminRuntimeService(database),
            sessions,
            origin: config.origin,
          });
        if (enableAccountState)
          registerAccountStateRoutes(app, {
            service: createAccountStateRuntimeService(database),
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
