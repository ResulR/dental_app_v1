import { z } from "zod";
import { OrderInstructionsSchema } from "./order-edit.js";
import { RevisionSchema } from "./schemas.js";
import { OrderSubmissionBaseResultSchema } from "./order-submission.js";
const Command = z
  .strictObject({
    source_order_id: z.uuid(),
    expected_source_version_id: z.uuid(),
    expected_source_revision: RevisionSchema.min(1),
    kind: z.enum(["replacement", "supplement"]),
    reason: z.string().trim().min(1).max(2000).optional(),
    input: OrderInstructionsSchema,
    idempotency_key: z.uuid(),
    confirmed_warnings: z.boolean(),
    exception_reason: z.string().trim().min(1).max(2000).optional(),
  })
  .refine((v) => v.kind !== "replacement" || !!v.reason);
export type LaboratoryLinkedWork = z.output<typeof Command>;
export const LaboratoryLinkedWorkSchema: z.ZodType<LaboratoryLinkedWork> =
  Command;
const Result = z.union([
  OrderSubmissionBaseResultSchema,
  z.strictObject({
    kind: z.literal("source_unavailable"),
    persisted: z.literal(false),
  }),
  z.strictObject({
    kind: z.literal("exception_required"),
    persisted: z.literal(false),
  }),
]);
export type LaboratoryLinkedWorkResult = z.output<typeof Result>;
export const LaboratoryLinkedWorkResultSchema: z.ZodType<LaboratoryLinkedWorkResult> =
  Result;

// A new order for an existing clinic has no parent work and no clinic approval
// step. The laboratory actor remains the author of the accepted version.
const ClinicOrder = z.strictObject({
  clinic_id: z.uuid(),
  input: OrderInstructionsSchema,
  idempotency_key: z.uuid(),
  confirmed_warnings: z.boolean(),
  exception_reason: z.string().trim().min(1).max(2000).optional(),
});
export type LaboratoryClinicOrder = z.output<typeof ClinicOrder>;
export const LaboratoryClinicOrderSchema: z.ZodType<LaboratoryClinicOrder> =
  ClinicOrder;
export const LaboratoryClinicOrderResultSchema = Result;
export type LaboratoryClinicOrderResult = z.output<typeof Result>;
export const LaboratoryClinicListQuerySchema = z.strictObject({
  after: z.uuid().optional(),
});
export const LaboratoryClinicListSchema = z.strictObject({
  items: z
    .array(z.strictObject({ id: z.uuid(), name: z.string().min(1) }))
    .max(50),
  next_after: z.uuid().nullable(),
});
