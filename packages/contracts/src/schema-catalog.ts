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
  ClinicContactUpdateSchema,
  ClinicProfileSchema,
} from "./clinic-profile.js";
import {
  LoginRequestSchema,
  EmptyAuthMutationSchema,
  SessionIdentitySchema,
} from "./authentication.js";
import {
  ClinicRegistrationRequestSchema,
  ClinicRegistrationReceiptSchema,
} from "./clinic-registration.js";
export function exportJsonSchemas() {
  const schemas = {
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
