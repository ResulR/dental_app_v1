import { z } from "zod";
import { OrderPreflightInputSchema } from "./order-preflight.js";
import { RevisionSchema, StatusSchema } from "./schemas.js";
export const OrderInstructionsSchema = OrderPreflightInputSchema.extend({
  requested_delivery_date: z.iso.date().nullable(),
});
const base = {
  order_id: z.uuid(),
  expected_version_id: z.uuid(),
  expected_revision: RevisionSchema.min(1),
  confirmed_warnings: z.boolean(),
};
const Command = z.discriminatedUnion("action", [
  z.strictObject({
    ...base,
    action: z.literal("save"),
    input: OrderInstructionsSchema,
    reason: z.string().trim().min(1).max(2000).optional(),
  }),
  z.strictObject({ ...base, action: z.literal("resubmit_correction") }),
]);
export type OrderEdit = z.output<typeof Command>;
export const OrderEditSchema: z.ZodType<OrderEdit> = Command;
export const OrderEditQuerySchema = z.strictObject({
  order_id: z.uuid(),
  version_id: z.uuid().optional(),
  before_version: RevisionSchema.min(1).optional(),
});
const View = z.strictObject({
  order_id: z.uuid(),
  number: z.string().regex(/^[1-9][0-9]*$/),
  status: StatusSchema,
  kind: z.enum(["normal", "retouch"]),
  origin: z.enum(["clinic", "laboratory"]),
  revision: RevisionSchema.min(1),
  current_version_id: z.uuid(),
  version_id: z.uuid(),
  input: OrderInstructionsSchema.extend({
    material_id: z.uuid().nullable(),
    shade_id: z.uuid().nullable(),
    work_type_id: z.uuid().nullable().optional(),
  }),
  file_count: z.number().int().min(0),
  labels: z.strictObject({
    material: z.string(),
    shade: z.string(),
    work_type: z.string().nullable(),
  }),
  history: z
    .array(
      z.strictObject({
        id: z.uuid(),
        version_number: RevisionSchema.min(1),
        created_at: z.iso.datetime(),
        created_by: z.uuid(),
        reason: z.string().nullable(),
      }),
    )
    .max(20),
  next_before_version: RevisionSchema.min(1).nullable(),
});
export type OrderEditView = z.output<typeof View>;
export const OrderEditViewSchema: z.ZodType<OrderEditView> = View;
export const OrderEditResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("updated"),
    order_id: z.uuid(),
    version_id: z.uuid(),
    revision: RevisionSchema.min(1),
    status: StatusSchema,
  }),
  z.strictObject({ kind: z.literal("conflict") }),
  z.strictObject({ kind: z.literal("confirmation_required") }),
  z.strictObject({
    kind: z.literal("blocked"),
    reason: z.enum([
      "catalog_missing",
      "catalog_forbidden",
      "files_not_ready",
      "pending_request",
      "security_block",
    ]),
  }),
]);
