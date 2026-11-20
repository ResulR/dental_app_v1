import { z } from "zod";
import { RevisionSchema } from "./schemas.js";
import { OrderSubmissionBaseResultSchema } from "./order-submission.js";
const Input = z.strictObject({
  source_order_id: z.uuid(),
  expected_source_version_id: z.uuid(),
  expected_source_revision: RevisionSchema.min(1),
  intervention_kind: z.enum(["retouch", "remanufacture"]),
  material_id: z.uuid(),
  shade_id: z.uuid(),
  description: z.string().trim().min(1).max(10000),
  file_ids: z.array(z.uuid()).refine((v) => new Set(v).size === v.length),
});
const Command = z.strictObject({
  input: Input,
  idempotency_key: z.uuid(),
  confirmed_warnings: z.boolean(),
});
export type RetouchSubmission = z.output<typeof Command>;
export const RetouchSubmissionSchema: z.ZodType<RetouchSubmission> = Command;
const Result = z.union([
  OrderSubmissionBaseResultSchema,
  z.strictObject({
    kind: z.literal("source_unavailable"),
    persisted: z.literal(false),
  }),
  z.strictObject({
    kind: z.literal("active_retouch"),
    persisted: z.literal(false),
  }),
]);
export type RetouchSubmissionResult = z.output<typeof Result>;
export const RetouchSubmissionResultSchema: z.ZodType<RetouchSubmissionResult> =
  Result;
