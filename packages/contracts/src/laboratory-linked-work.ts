import { z } from "zod";
import { OrderInstructionsSchema } from "./order-edit.js";
import { RevisionSchema } from "./schemas.js";
import { OrderSubmissionResultSchema } from "./order-submission.js";
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
  OrderSubmissionResultSchema,
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
