import { z } from "zod";
import { OrderPreflightInputSchema } from "./order-preflight.js";
export const OrderSubmissionSchema = z.strictObject({
  idempotency_key: z.uuid(),
  input: OrderPreflightInputSchema,
  confirmed_warnings: z.boolean(),
});
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
]);
