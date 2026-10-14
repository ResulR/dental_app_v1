export {
  createClinicRegistrationService,
  clinicCanSubmit,
} from "./registration.service.js";
export type {
  ClinicRegistration,
  RegistrationResult,
} from "./registration.service.js";

export { createClinicReviewService } from "./review.service.js";
export type { ClinicDecision } from "./review.service.js";
export { createClinicProfileService } from "./profile.service.js";
export { createClinicEmailChangeService } from "./email-change.service.js";
export type { EmailChangeRecord } from "./email-change.service.js";

export { registerClinicRegistrationRoutes } from "./registration.routes.js";

export { createClinicRegistrationRepository } from "./registration.repository.js";

export { createRegistrationTermsRepository } from "./registration-terms.repository.js";
export { assertRegistrationStorageReady } from "./registration-readiness.js";

export { registerClinicManagementRoutes } from "./management.routes.js";
export {
  createClinicManagementRepository,
  assertClinicManagementStorageReady,
} from "./management.repository.js";
