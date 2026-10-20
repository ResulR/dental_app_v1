import { z } from "zod";
import { RevisionSchema, StatusSchema } from "./schemas.js";
export const DeliveryPriorityQuerySchema = z.strictObject({
  order_id: z.uuid(),
});
export const DeliveryPriorityCommandSchema = z.strictObject({
  order_id: z.uuid(),
  expected_version_id: z.uuid(),
  expected_order_revision: RevisionSchema.min(1),
  expected_logistics_revision: RevisionSchema.min(1),
  priority: z.boolean(),
});
export const DeliveryPriorityContextSchema = z.strictObject({
  order_id: z.uuid(),
  version_id: z.uuid(),
  status: StatusSchema,
  order_revision: RevisionSchema.min(1),
  logistics_revision: RevisionSchema.min(1),
  priority: z.boolean(),
  recent_changes: z
    .array(
      z.strictObject({
        id: z.uuid(),
        occurred_at: z.iso.datetime(),
        before: z.boolean(),
        after: z.boolean(),
      }),
    )
    .max(20),
  more_history: z.boolean(),
});
export const DeliveryPriorityResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("updated"),
    priority: z.boolean(),
    logistics_revision: RevisionSchema.min(1),
  }),
  z.strictObject({ kind: z.literal("unchanged") }),
  z.strictObject({ kind: z.literal("conflict") }),
  z.strictObject({ kind: z.literal("closed") }),
]);
export type DeliveryPriorityContext = z.output<
  typeof DeliveryPriorityContextSchema
>;
