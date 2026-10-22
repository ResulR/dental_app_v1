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
export const MessagingInboxQuerySchema = z
  .strictObject({
    search: z.string().trim().max(80).optional(),
    kind: z.enum(["general", "order"]).optional(),
    unread_only: z.boolean().optional(),
    before_at: z.iso.datetime().optional(),
    before_id: z.uuid().optional(),
  })
  .refine(
    (value) =>
      (value.before_at === undefined) === (value.before_id === undefined),
  );
export const MessagingInboxPageSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        conversation_id: z.uuid(),
        clinic_id: z.uuid(),
        clinic_name: z.string(),
        kind: z.enum(["general", "order"]),
        order_id: z.uuid().nullable(),
        order_number: z
          .string()
          .regex(/^[1-9][0-9]*$/)
          .nullable(),
        unread_count: z.number().int().nonnegative(),
        activity_at: z.iso.datetime(),
        closed: z.boolean(),
      }),
    )
    .max(50),
  next_before_at: z.iso.datetime().nullable(),
  next_before_id: z.uuid().nullable(),
});
export const OrderConversationQuerySchema = z.strictObject({
  order_id: z.uuid(),
});
export const OrderConversationResultSchema = z.strictObject({
  id: z.uuid(),
  order_id: z.uuid(),
  clinic_id: z.uuid(),
  closed: z.boolean(),
  last_message_seq: z.number().int().nonnegative(),
  unread_count: z.number().int().nonnegative(),
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
export const MessageMutationSchema = z.strictObject({
  conversation_id: z.uuid(),
  message_id: z.uuid(),
  expected_revision: z.number().int().positive(),
  body: z.string().trim().min(1).max(100_000).optional(),
});
export const MessageMutationResultSchema = z.strictObject({
  kind: z.enum(["updated", "conflict", "closed"]),
  revision: z.number().int().positive().nullable(),
});
export const MessageHistoryQuerySchema = z.strictObject({
  conversation_id: z.uuid(),
  message_id: z.uuid(),
  before_version: z.number().int().positive().optional(),
});
export const MessageHistoryResultSchema = z.strictObject({
  versions: z
    .array(
      z.strictObject({
        version_number: z.number().int().positive(),
        body: z.string().nullable(),
        created_at: z.iso.datetime(),
      }),
    )
    .max(50),
  next_before_version: z.number().int().positive().nullable(),
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
        own: z.boolean(),
        revision: z.number().int().positive(),
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
