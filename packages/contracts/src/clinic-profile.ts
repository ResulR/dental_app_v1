import { z } from "zod";
import { ObjectIdSchema, RevisionSchema } from "./schemas.js";
const contact = z.string().trim().min(1).max(2000);
export const ClinicContactFieldsSchema = z.strictObject({
  name: contact,
  dentist_first_name: contact,
  dentist_last_name: contact,
  phone: contact,
  address: contact,
});
export const ClinicContactUpdateSchema = z.strictObject({
  expected_revision: RevisionSchema.min(1),
  ...ClinicContactFieldsSchema.shape,
});
export const ClinicProfileSchema = z.strictObject({
  id: ObjectIdSchema,
  revision: RevisionSchema.min(1),
  ...ClinicContactFieldsSchema.shape,
});
export type ClinicContactFields = z.infer<typeof ClinicContactFieldsSchema>;
export type ClinicContactUpdate = z.infer<typeof ClinicContactUpdateSchema>;
export type ClinicProfile = z.infer<typeof ClinicProfileSchema>;

export const ClinicContactHistorySchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: ObjectIdSchema,
        actor_id: ObjectIdSchema,
        previous_revision: RevisionSchema.min(1),
        revision: RevisionSchema.min(2),
        occurred_at: z.iso.datetime(),
        previous: ClinicContactFieldsSchema,
        next: ClinicContactFieldsSchema,
      }),
    )
    .max(50),
  next_before: RevisionSchema.min(1).nullable(),
});
export type ClinicContactHistory = z.infer<typeof ClinicContactHistorySchema>;
