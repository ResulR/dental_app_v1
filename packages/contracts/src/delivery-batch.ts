import { z } from "zod";
import { RevisionSchema } from "./schemas.js";
export const DeliveryBatchItemSchema = z.strictObject({
  order_id: z.uuid(),
  expected_version_id: z.uuid(),
  expected_revision: RevisionSchema.min(1),
  mode: z.enum(["laboratory_delivery", "clinic_pickup", "external_courier"]),
});
export const DeliveryBatchCommandSchema = z.strictObject({
  receipt_id: z.uuid(),
  confirmed: z.literal(true),
  items: z
    .array(DeliveryBatchItemSchema)
    .min(2)
    .max(10)
    .superRefine((items, ctx) => {
      const seen = new Set<string>();
      for (const [index, item] of items.entries()) {
        if (seen.has(item.order_id))
          ctx.addIssue({
            code: "custom",
            path: [index, "order_id"],
            message: "duplicate order",
          });
        seen.add(item.order_id);
      }
    }),
});
export const DeliveryBatchReceiptQuerySchema = z.strictObject({
  receipt_id: z.uuid(),
});
export const DeliveryBatchResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("delivered"),
    receipt_id: z.uuid(),
    delivered_at: z.string(),
    items: z
      .array(
        z.strictObject({ order_id: z.uuid(), revision: RevisionSchema.min(1) }),
      )
      .min(2)
      .max(10),
  }),
  z.strictObject({ kind: z.literal("conflict") }),
  z.strictObject({
    kind: z.literal("blocked"),
    reason: z.enum([
      "catalog_missing",
      "catalog_forbidden",
      "security_block",
      "files_not_ready",
      "pending_request",
    ]),
  }),
  z.strictObject({ kind: z.literal("receipt_missing") }),
  z.strictObject({ kind: z.literal("receipt_mismatch") }),
]);
export type DeliveryBatchCommand = z.output<typeof DeliveryBatchCommandSchema>;
export type DeliveryBatchResult = z.output<typeof DeliveryBatchResultSchema>;
