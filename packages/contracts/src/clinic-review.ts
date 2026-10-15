import { ClinicIdSchema } from "./clinic-profile.js";
import { z } from "zod";
import { RevisionSchema, ObjectIdSchema } from "./schemas.js";
export const ClinicReviewRequestSchema = z.strictObject({
  expected_revision: RevisionSchema.min(1),
  decision: z.enum(["approved", "refused"]),
  reason: z.string().trim().max(2000).optional(),
});
export type ClinicReviewRequest = z.infer<typeof ClinicReviewRequestSchema>;

export const ClinicReviewQueueSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: ObjectIdSchema,
        name: z.string().min(1).max(2000),
        revision: RevisionSchema.min(1),
      }),
    )
    .max(50),
  next_after: ObjectIdSchema.nullable(),
});
export type ClinicReviewQueue = z.infer<typeof ClinicReviewQueueSchema>;

export const ClinicDirectorySchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: ClinicIdSchema,
        name: z.string().min(1).max(2000),
        revision: RevisionSchema.min(1),
        review_state: z.enum(["pending", "approved", "refused"]),
        suspended: z.boolean(),
      }),
    )
    .max(50),
  next_after: ClinicIdSchema.nullable(),
});
export type ClinicDirectory = z.infer<typeof ClinicDirectorySchema>;
