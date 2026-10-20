import { z } from "zod";
const Input = z
  .strictObject({
    conversation_id: z.uuid(),
    idempotency_key: z.uuid(),
    body: z.string().trim().min(1).max(100_000).nullable(),
    file_ids: z.array(z.uuid()),
  })
  .refine((v) => v.body !== null || v.file_ids.length > 0);
const Result = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("sent"),
    persisted: z.literal(true),
    message_id: z.uuid(),
    version_id: z.uuid(),
    sequence_number: z.number().int().positive(),
    created_at: z.iso.datetime(),
    replayed: z.boolean(),
  }),
  z.strictObject({
    kind: z.enum(["conflict", "conversation_closed", "files_not_ready"]),
    persisted: z.literal(false),
  }),
]);
export type MessageSubmission = z.output<typeof Input>;
export const MessageSubmissionSchema: z.ZodType<MessageSubmission> = Input;
export type MessageSubmissionResult = z.output<typeof Result>;
export const MessageSubmissionResultSchema: z.ZodType<MessageSubmissionResult> =
  Result;
