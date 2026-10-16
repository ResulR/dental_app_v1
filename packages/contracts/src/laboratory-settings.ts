import { z } from "zod";
import { RevisionSchema } from "./schemas.js";
const text = (max: number) => z.string().trim().min(1).max(max).nullable();
export const LaboratoryFieldsSchema = z.strictObject({
  name: text(200),
  address: text(1000),
  phone: text(100),
  email: z.email().max(254).nullable(),
  opening_hours: text(2000),
  map_url: z
    .url({ protocol: /^https$/ })
    .max(2048)
    .refine((value) => {
      const url = new URL(value);
      return !url.username && !url.password;
    })
    .nullable(),
});
export const LaboratoryProfileSchema = z.strictObject({
  revision: RevisionSchema,
  fields: LaboratoryFieldsSchema.nullable(),
});
export const LaboratoryUpdateSchema = z.strictObject({
  expected_revision: RevisionSchema,
  fields: LaboratoryFieldsSchema,
});
export const LaboratoryMutationResultSchema = z.strictObject({
  kind: z.enum(["applied", "conflict", "denied", "invalid"]),
});
export const LaboratoryHistorySchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.uuid(),
        actor_id: z.uuid(),
        revision: RevisionSchema.min(1),
        occurred_at: z.iso.datetime(),
        previous: LaboratoryFieldsSchema.nullable(),
        next: LaboratoryFieldsSchema,
      }),
    )
    .max(50),
  next_before: RevisionSchema.min(1).nullable(),
});
