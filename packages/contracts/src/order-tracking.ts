import { z } from "zod";
import { StatusSchema, RevisionSchema } from "./schemas.js";
import { OrderReviewPageSchema } from "./order-review.js";
const OrderSearchDefinition = z
  .strictObject({
    q: z.string().trim().max(120).optional(),
    status: StatusSchema.optional(),
    kind: z.enum(["normal", "retouch"]).optional(),
    date_kind: z.enum(["requested", "planned"]).default("requested"),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    after: z.uuid().optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to);
const OrderTrackingPageDefinition = z.strictObject({
  can_read_details: z.boolean(),
  items: z
    .array(
      z.strictObject({
        id: z.uuid(),
        number: z.string().regex(/^[1-9][0-9]*$/),
        clinic_name: z.string(),
        kind: z.enum(["normal", "retouch"]),
        origin: z.enum(["clinic", "laboratory"]),
        status: StatusSchema,
        received_at: z.iso.datetime(),
        requested_delivery_date: z.iso.date().nullable(),
        planned_delivery_date: z.iso.date().nullable(),
        priority: z.boolean(),
      }),
    )
    .max(50),
  next_after: z.uuid().nullable(),
});
const OrderDetailQueryDefinition = z.strictObject({
  order_id: z.uuid(),
  before_revision: RevisionSchema.min(1).optional(),
});
const OrderTrackingDetailDefinition = z.strictObject({
  order: OrderReviewPageSchema.shape.items.element.extend({
    status: StatusSchema,
    received_at: z.iso.datetime(),
    planned_delivery_date: z.iso.date().nullable(),
    priority: z.boolean(),
  }),
  history: z
    .array(
      z.strictObject({
        previous_status: StatusSchema.nullable(),
        next_status: StatusSchema,
        occurred_at: z.iso.datetime(),
        reason: z.string().nullable(),
        actor_id: z.uuid(),
        aggregate_revision: RevisionSchema.min(1),
        decided_version_id: z.uuid().nullable(),
      }),
    )
    .max(100),
  next_before_revision: RevisionSchema.min(1).nullable(),
});

export type OrderSearch = z.output<typeof OrderSearchDefinition>;
export const OrderSearchSchema: z.ZodType<OrderSearch> = OrderSearchDefinition;

export type OrderTrackingPage = z.output<typeof OrderTrackingPageDefinition>;
export const OrderTrackingPageSchema: z.ZodType<OrderTrackingPage> =
  OrderTrackingPageDefinition;

export type OrderDetailQuery = z.output<typeof OrderDetailQueryDefinition>;
export const OrderDetailQuerySchema: z.ZodType<OrderDetailQuery> =
  OrderDetailQueryDefinition;

export type OrderTrackingDetail = z.output<
  typeof OrderTrackingDetailDefinition
>;
export const OrderTrackingDetailSchema: z.ZodType<OrderTrackingDetail> =
  OrderTrackingDetailDefinition;
