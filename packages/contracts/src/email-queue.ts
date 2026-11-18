import { z } from "zod";
export const EmailQueueQuerySchema = z.strictObject({
  state: z
    .enum(["pending", "provider_accepted", "failed", "cancelled"])
    .optional(),
  before: z
    .strictObject({ created_at: z.iso.datetime(), id: z.uuid() })
    .optional(),
});
export const EmailQueuePageSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.uuid(),
        created_at: z.iso.datetime(),
        event_type: z.string(),
        purpose: z.enum([
          "business",
          "message_reminder",
          "security",
          "technical",
        ]),
        state: z.enum(["pending", "provider_accepted", "failed", "cancelled"]),
        attempt_count: z.number().int().nonnegative(),
        next_attempt_at: z.iso.datetime(),
        last_result: z
          .enum([
            "provider_accepted",
            "temporary_error",
            "permanent_error",
            "ambiguous",
          ])
          .nullable(),
        last_error_code: z.string().nullable(),
        last_attempt_at: z.iso.datetime().nullable(),
        cancellation_code: z.string().nullable(),
      }),
    )
    .max(50),
  next_before: z
    .strictObject({ created_at: z.iso.datetime(), id: z.uuid() })
    .nullable(),
});
