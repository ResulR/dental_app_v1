import { z } from "zod";
import { RevisionSchema } from "./schemas.js";
import { OrderLifecycleContextSchema } from "./order-lifecycle.js";
const base = {
  order_id: z.uuid(),
  expected_version_id: z.uuid(),
  expected_revision: RevisionSchema.min(1),
};
const request = {
  request_id: z.uuid(),
  expected_request_revision: RevisionSchema.min(1),
};
const Command = z.discriminatedUnion("action", [
  z.strictObject({
    ...base,
    action: z.literal("request_cancellation"),
    confirmed: z.literal(true),
  }),
  z.strictObject({
    ...base,
    ...request,
    action: z.literal("withdraw"),
    confirmed: z.literal(true),
  }),
  z.strictObject({
    ...base,
    ...request,
    action: z.literal("accept_cancellation"),
    confirmed: z.literal(true),
    reason: z.string().trim().min(1).max(2000),
  }),
  z.strictObject({
    ...base,
    ...request,
    action: z.literal("reject_cancellation"),
    reason: z.string().trim().min(1).max(2000),
  }),
]);
export type OrderCancellationRequest = z.output<typeof Command>;
export const OrderCancellationRequestSchema: z.ZodType<OrderCancellationRequest> =
  Command;
export const OrderRequestContextSchema = z.strictObject({
  order: OrderLifecycleContextSchema,
  pending: z
    .strictObject({
      id: z.uuid(),
      kind: z.enum(["modification", "cancellation"]),
      revision: RevisionSchema.min(1),
    })
    .nullable(),
});
export const OrderRequestResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("updated"),
    order_id: z.uuid(),
    revision: RevisionSchema.min(1),
    request_id: z.uuid(),
    state: z.enum(["pending", "withdrawn", "accepted", "rejected"]),
  }),
  z.strictObject({ kind: z.literal("conflict") }),
  z.strictObject({ kind: z.literal("pending_request") }),
]);
