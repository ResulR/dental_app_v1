import { OrderReviewPageSchema } from "./order-review.js";
import {
  OrderDecisionSchema,
  OrderDecisionResultSchema,
} from "./order-decision.js";
import {
  OrderSubmissionSchema,
  OrderSubmissionResultSchema,
} from "./order-submission.js";
import {
  OrderPreflightInputSchema,
  OrderPreflightResultSchema,
} from "./order-preflight.js";
import {
  LaboratoryFieldsSchema,
  LaboratoryProfileSchema,
  LaboratoryUpdateSchema,
  LaboratoryMutationResultSchema,
  LaboratoryHistorySchema,
} from "./laboratory-settings.js";
import {
  CatalogImpactsSchema,
  CatalogCreateSchema,
  CatalogEditSchema,
  CatalogManagedFieldsSchema,
  CatalogManagedProfileSchema,
  CatalogManagedPageSchema,
  CatalogMutationResultSchema,
  CatalogHistorySchema,
} from "./catalog-management.js";
import {
  CatalogKindSchema,
  ActiveCatalogItemSchema,
  ActiveCatalogPageSchema,
} from "./catalog.js";
import {
  AdminCommandSchema,
  AdminFieldsSchema,
  AdminProfileSchema,
  AdminListSchema,
  AdminResultSchema,
  AdminHistorySchema,
} from "./admin-management.js";
import {
  ManagedProfileSchema,
  AccountStateCommandSchema,
  AccountStateFieldsSchema,
  AccountStateProfileSchema,
  AccountStateListSchema,
  AccountStateResultSchema,
  AccountStateHistorySchema,
} from "./account-state.js";
import {
  DelegationKindSchema,
  DelegationCommandSchema,
  DelegationListSchema,
  DelegationProfileSchema,
  DelegationResultSchema,
  DelegationHistorySchema,
} from "./delegation.js";
import { EffectivePermissionsSchema } from "./permissions.js";
import {
  ClinicReviewRequestSchema,
  ClinicReviewQueueSchema,
  ClinicDirectorySchema,
} from "./clinic-review.js";
import { z } from "zod";
import {
  ObjectIdSchema,
  RevisionSchema,
  StatusSchema,
  PatientSchema,
  ToothSchema,
  ClinicSubmissionSchema,
  MutationPreconditionSchema,
  ProblemSchema,
  LogisticsProjectionSchema,
  SubmissionReceiptSchema,
  HealthSchema,
} from "./schemas.js";
import {
  ClinicContactFieldsSchema,
  ClinicContactHistorySchema,
  ClinicContactUpdateSchema,
  ClinicProfileSchema,
} from "./clinic-profile.js";
import {
  LoginRequestSchema,
  EmptyAuthMutationSchema,
  SessionIdentitySchema,
} from "./authentication.js";
import {
  RegistrationTermsSchema,
  ClinicRegistrationRequestSchema,
  ClinicRegistrationReceiptSchema,
} from "./clinic-registration.js";
export function exportJsonSchemas() {
  const schemas = {
    OrderReviewPage: OrderReviewPageSchema,
    OrderDecision: OrderDecisionSchema,
    OrderDecisionResult: OrderDecisionResultSchema,
    OrderSubmission: OrderSubmissionSchema,
    OrderSubmissionResult: OrderSubmissionResultSchema,
    OrderPreflightInput: OrderPreflightInputSchema,
    OrderPreflightResult: OrderPreflightResultSchema,
    LaboratoryFields: LaboratoryFieldsSchema,
    LaboratoryProfile: LaboratoryProfileSchema,
    LaboratoryUpdate: LaboratoryUpdateSchema,
    LaboratoryMutationResult: LaboratoryMutationResultSchema,
    LaboratoryHistory: LaboratoryHistorySchema,

    ManagedProfile: ManagedProfileSchema,
    AccountStateCommand: AccountStateCommandSchema,
    AccountStateFields: AccountStateFieldsSchema,
    CatalogImpacts: CatalogImpactsSchema,
    CatalogCreate: CatalogCreateSchema,
    CatalogEdit: CatalogEditSchema,
    CatalogManagedFields: CatalogManagedFieldsSchema,
    CatalogManagedProfile: CatalogManagedProfileSchema,
    CatalogManagedPage: CatalogManagedPageSchema,
    CatalogMutationResult: CatalogMutationResultSchema,
    CatalogHistory: CatalogHistorySchema,
    CatalogKind: CatalogKindSchema,
    ActiveCatalogItem: ActiveCatalogItemSchema,
    ActiveCatalogPage: ActiveCatalogPageSchema,
    AdminCommand: AdminCommandSchema,
    AdminFields: AdminFieldsSchema,
    AdminProfile: AdminProfileSchema,
    AdminList: AdminListSchema,
    AdminResult: AdminResultSchema,
    AdminHistory: AdminHistorySchema,
    AccountStateProfile: AccountStateProfileSchema,
    AccountStateList: AccountStateListSchema,
    AccountStateResult: AccountStateResultSchema,
    AccountStateHistory: AccountStateHistorySchema,

    DelegationKind: DelegationKindSchema,
    DelegationCommand: DelegationCommandSchema,
    DelegationList: DelegationListSchema,
    DelegationProfile: DelegationProfileSchema,
    DelegationResult: DelegationResultSchema,
    DelegationHistory: DelegationHistorySchema,

    EffectivePermissions: EffectivePermissionsSchema,
    ClinicReviewRequest: ClinicReviewRequestSchema,
    ClinicReviewQueue: ClinicReviewQueueSchema,
    ClinicDirectory: ClinicDirectorySchema,
    RegistrationTerms: RegistrationTermsSchema,
    ClinicRegistrationRequest: ClinicRegistrationRequestSchema,
    ClinicRegistrationReceipt: ClinicRegistrationReceiptSchema,
    LoginRequest: LoginRequestSchema,
    EmptyAuthMutation: EmptyAuthMutationSchema,
    SessionIdentity: SessionIdentitySchema,
    ObjectId: ObjectIdSchema,
    Revision: RevisionSchema,
    Status: StatusSchema,
    Patient: PatientSchema,
    Tooth: ToothSchema,
    ClinicSubmission: ClinicSubmissionSchema,
    MutationPrecondition: MutationPreconditionSchema,
    Problem: ProblemSchema,
    LogisticsProjection: LogisticsProjectionSchema,
    SubmissionReceipt: SubmissionReceiptSchema,
    Health: HealthSchema,
    ClinicContactFields: ClinicContactFieldsSchema,
    ClinicContactHistory: ClinicContactHistorySchema,
    ClinicContactUpdate: ClinicContactUpdateSchema,
    ClinicProfile: ClinicProfileSchema,
  };
  return Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => [
      name,
      z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" }),
    ]),
  );
}
