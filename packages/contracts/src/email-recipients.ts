import { z } from "zod";
export const EmailRecipientCategorySchema = z.enum([
  "order_submitted",
  "clinic_registered",
  "modification_requested",
  "cancellation_requested",
  "retouch_requested",
  "correction_resubmitted",
]);
export const EmailRecipientsSchema = z
  .array(EmailRecipientCategorySchema)
  .max(6);
export const EmailRecipientCommandSchema = z.strictObject({
  category: EmailRecipientCategorySchema,
  expected_selected: z.boolean(),
  selected: z.boolean(),
});
export const EmailRecipientResultSchema = z.strictObject({
  kind: z.enum(["applied", "denied", "conflict"]),
});
