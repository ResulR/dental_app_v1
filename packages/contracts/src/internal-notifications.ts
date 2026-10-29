import { z } from "zod";

export const InternalNoticeQuerySchema = z
  .strictObject({
    before_at: z.iso.datetime().optional(),
    before_id: z.uuid().optional(),
  })
  .refine((q) => (q.before_at === undefined) === (q.before_id === undefined));
export const InternalNoticePageSchema = z.strictObject({
  unread_count: z.number().int().nonnegative(),
  items: z
    .array(
      z.strictObject({
        id: z.uuid(),
        kind: z.enum([
          "clinic_registered",
          "order_submitted",
          "correction_resubmitted",
          "correction_requested",
          "cancellation_requested",
          "modification_requested",
          "retouch_requested",
          "message_created",
        ]),
        clinic_id: z.uuid(),
        order_id: z.uuid().nullable(),
        conversation_id: z.uuid().nullable(),
        clinic_name: z.string(),
        clinic_revision: z.number().int().positive(),
        created_at: z.iso.datetime(),
        read_at: z.iso.datetime().nullable(),
      }),
    )
    .max(50),
  next_before_at: z.iso.datetime().nullable(),
  next_before_id: z.uuid().nullable(),
});
export const InternalNoticeReadSchema = z.strictObject({ id: z.uuid() });
export const InternalNoticeReadResultSchema = z.strictObject({
  id: z.uuid(),
  read_at: z.iso.datetime(),
});
