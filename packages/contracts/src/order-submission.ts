import { z } from "zod";
import { OrderPreflightInputSchema } from "./order-preflight.js";
export const OrderSubmissionSchema = z
  .strictObject({
    idempotency_key: z.uuid(),
    input: OrderPreflightInputSchema,
    confirmed_warnings: z.boolean(),
    draft_id: z.uuid().optional(),
    draft_revision: z.number().int().min(1).max(2147483647).optional(),
  })
  .refine(
    (value) =>
      (value.draft_id === undefined) === (value.draft_revision === undefined),
  );
export const OrderSubmissionResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("submitted"),
    persisted: z.literal(true),
    order_id: z.uuid(),
    number: z.string().regex(/^[1-9][0-9]*$/),
    received_at: z.iso.datetime(),
    replayed: z.boolean(),
  }),
  z.strictObject({
    kind: z.literal("blocked"),
    persisted: z.literal(false),
    reasons: z
      .array(
        z.enum(["catalog_missing", "catalog_forbidden", "files_not_ready"]),
      )
      .min(1),
  }),
  z.strictObject({
    kind: z.literal("confirmation_required"),
    persisted: z.literal(false),
    warnings: z.array(z.enum(["catalog_unavailable", "low_detail"])).min(1),
  }),
  z.strictObject({ kind: z.literal("conflict"), persisted: z.literal(false) }),
  z.strictObject({
    kind: z.literal("draft_conflict"),
    persisted: z.literal(false),
  }),
]);
