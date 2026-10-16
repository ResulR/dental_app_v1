import { z } from "zod";
import { PatientSchema, ToothSchema, RevisionSchema } from "./schemas.js";
export const OrderReviewPageSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.uuid(),
        number: z.string().regex(/^[1-9][0-9]*$/),
        clinic_name: z.string(),
        kind: z.enum(["normal", "retouch"]),
        origin: z.enum(["clinic", "laboratory"]),
        status: z.enum(["pending", "accepted"]),
        revision: RevisionSchema.min(1),
        version_id: z.uuid(),
        patient: PatientSchema,
        requested_delivery_date: z.string().nullable(),
        description: z.string().nullable(),
        material: z.string(),
        shade: z.string(),
        work_type: z.string().nullable(),
        teeth: z.array(ToothSchema),
        file_count: z.number().int().nonnegative(),
        security_block: z.boolean(),
      }),
    )
    .max(50),
  next_after: z.uuid().nullable(),
});
