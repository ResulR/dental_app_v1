import { z } from "zod";
import { RevisionSchema, StatusSchema } from "./schemas.js";
const base = {
  order_id: z.uuid(),
  expected_version_id: z.uuid(),
  expected_revision: RevisionSchema.min(1),
};
const reason = z.string().trim().min(1).max(2000);
const Command = z.discriminatedUnion("action", [
  z.strictObject({ ...base, action: z.literal("complete") }),
  z.strictObject({
    ...base,
    action: z.literal("deliver"),
    confirmed: z.literal(true),
    mode: z.enum(["laboratory_delivery", "clinic_pickup", "external_courier"]),
  }),
  z.strictObject({ ...base, action: z.literal("correct_delivery"), reason }),
  z.strictObject({ ...base, action: z.literal("request_correction"), reason }),
  z.strictObject({
    ...base,
    action: z.literal("cancel"),
    confirmed: z.literal(true),
    reason: reason.optional(),
  }),
]);
const Result = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("updated"),
    order_id: z.uuid(),
    status: StatusSchema,
    revision: RevisionSchema.min(1),
    version_id: z.uuid(),
  }),
  z.strictObject({ kind: z.literal("conflict") }),
  z.strictObject({
    kind: z.literal("blocked"),
    reason: z.enum([
      "security_block",
      "catalog_forbidden",
      "catalog_missing",
      "files_not_ready",
      "pending_request",
      "linked_retouch",
      "active_retouch",
    ]),
  }),
]);
export type OrderLifecycle = z.output<typeof Command>;
export const OrderLifecycleSchema: z.ZodType<OrderLifecycle> = Command;
export type OrderLifecycleResult = z.output<typeof Result>;
export const OrderLifecycleResultSchema: z.ZodType<OrderLifecycleResult> =
  Result;

export const OrderLifecycleContextQuerySchema = z.strictObject({
  order_id: z.uuid(),
});
export const OrderLifecycleContextSchema = z.strictObject({
  order_id: z.uuid(),
  number: z.string().regex(/^[1-9][0-9]*$/),
  status: StatusSchema,
  version_id: z.uuid(),
  revision: RevisionSchema.min(1),
});
