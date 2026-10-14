import { z } from "zod";
import { ClinicContactFieldsSchema } from "./clinic-profile.js";

// Transport bounds complement server-side email canonicalisation and password
// byte/code-point checks. No client field can choose a profile or review state.
export const ClinicRegistrationRequestSchema = z.strictObject({
  ...ClinicContactFieldsSchema.shape,
  email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(1024),
  accepted_terms: z.literal(true),
  terms_version_id: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu),
});
export const ClinicRegistrationReceiptSchema = z.strictObject({
  kind: z.literal("pending"),
});
export type ClinicRegistration = z.infer<
  typeof ClinicRegistrationRequestSchema
>;
