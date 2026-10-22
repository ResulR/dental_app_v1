import { z } from "zod";

export const GeneralConversationQuerySchema = z.strictObject({
  clinic_id: z.uuid().optional(),
  after: z.uuid().optional(),
});
export const GeneralConversationPageSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.uuid(),
        clinic_id: z.uuid(),
        clinic_name: z.string(),
        last_message_seq: z.number().int().nonnegative(),
        unread_count: z.number().int().nonnegative(),
      }),
    )
    .max(50),
  next_after: z.uuid().nullable(),
});
export const GeneralMessageQuerySchema = z
  .strictObject({
    conversation_id: z.uuid(),
    before_seq: z.number().int().positive().optional(),
    after_seq: z.number().int().nonnegative().optional(),
  })
  .refine(
    (query) => query.before_seq === undefined || query.after_seq === undefined,
  );
export const GeneralReadCommandSchema = z.strictObject({
  conversation_id: z.uuid(),
  through_seq: z.number().int().positive(),
});
export const GeneralReadReceiptSchema = z.strictObject({
  conversation_id: z.uuid(),
  last_read_seq: z.number().int().nonnegative(),
});
export const GeneralMessagePageSchema = z.strictObject({
  conversation_id: z.uuid(),
  last_read_seq: z.number().int().nonnegative(),
  other_read_seq: z.number().int().nonnegative(),
  last_message_seq: z.number().int().nonnegative(),
  messages: z
    .array(
      z.strictObject({
        id: z.uuid(),
        sequence_number: z.number().int().positive(),
        sender_side: z.enum(["clinic", "laboratory"]),
        body: z.string().nullable(),
        created_at: z.iso.datetime(),
        hidden: z.boolean(),
        edited: z.boolean(),
      }),
    )
    .max(50),
  next_before_seq: z.number().int().positive().nullable(),
  next_after_seq: z.number().int().positive().nullable(),
});
