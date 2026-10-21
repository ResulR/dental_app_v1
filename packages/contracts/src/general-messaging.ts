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
      }),
    )
    .max(50),
  next_after: z.uuid().nullable(),
});
export const GeneralMessageQuerySchema = z.strictObject({
  conversation_id: z.uuid(),
  before_seq: z.number().int().positive().optional(),
});
export const GeneralMessagePageSchema = z.strictObject({
  conversation_id: z.uuid(),
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
});
