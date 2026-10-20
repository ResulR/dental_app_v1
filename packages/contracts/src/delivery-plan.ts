import { z } from "zod";
import { RevisionSchema, StatusSchema } from "./schemas.js";
const DateValue = z.iso.date();
export const DeliveryPlanQuerySchema = z.strictObject({ order_id: z.uuid() });
export const DeliveryPlanCommandSchema = z.strictObject({
  order_id: z.uuid(),
  expected_version_id: z.uuid(),
  expected_order_revision: RevisionSchema.min(1),
  expected_logistics_revision: RevisionSchema.min(1),
  planned_delivery_date: DateValue.nullable(),
});
export const DeliveryPlanContextSchema = z.strictObject({
  order_id: z.uuid(),
  version_id: z.uuid(),
  status: StatusSchema,
  order_revision: RevisionSchema.min(1),
  logistics_revision: RevisionSchema.min(1),
  requested_delivery_date: DateValue,
  planned_delivery_date: DateValue.nullable(),
  recent_changes: z
    .array(
      z.strictObject({
        id: z.uuid(),
        occurred_at: z.iso.datetime(),
        before: DateValue.nullable(),
        after: DateValue.nullable(),
      }),
    )
    .max(20),
  more_history: z.boolean(),
});
export const DeliveryPlanResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("updated"),
    planned_delivery_date: DateValue.nullable(),
    logistics_revision: RevisionSchema.min(1),
  }),
  z.strictObject({ kind: z.literal("unchanged") }),
  z.strictObject({ kind: z.literal("conflict") }),
  z.strictObject({ kind: z.literal("closed") }),
]);
export type DeliveryPlanCommand = z.output<typeof DeliveryPlanCommandSchema>;
export type DeliveryPlanContext = z.output<typeof DeliveryPlanContextSchema>;
export type DeliveryPlanResult = z.output<typeof DeliveryPlanResultSchema>;
