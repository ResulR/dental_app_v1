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
const PriorityChangeSchema = z.strictObject({
  id: z.uuid(),
  occurred_at: z.iso.datetime(),
  before: z.boolean(),
  after: z.boolean(),
});
export const DeliveryPriorityHistoryQuerySchema = z.strictObject({
  order_id: z.uuid(),
  expected_logistics_revision: RevisionSchema.min(1),
  before_event_id: z.uuid().optional(),
});
export const DeliveryPriorityHistoryPageSchema = z.strictObject({
  order_id: z.uuid(),
  logistics_revision: RevisionSchema.min(1),
  items: z.array(PriorityChangeSchema).max(20),
  next_before_event_id: z.uuid().nullable(),
});
export type DeliveryPriorityHistoryPage = z.output<
  typeof DeliveryPriorityHistoryPageSchema
>;
export const DeliveryPriorityContextSchema = z.strictObject({
  order_id: z.uuid(),
  version_id: z.uuid(),
  status: StatusSchema,
  order_revision: RevisionSchema.min(1),
  logistics_revision: RevisionSchema.min(1),
  priority: z.boolean(),
  recent_changes: z.array(PriorityChangeSchema).max(20),
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
