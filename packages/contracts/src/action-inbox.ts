import { z } from "zod";
import { RevisionSchema } from "./schemas.js";
import { PermissionCodeSchema } from "./permissions.js";
const Kind = z.enum([
  "new_order",
  "correction_resubmitted",
  "retouch",
  "modification",
  "cancellation",
  "registration",
]);
const Cursor = z.strictObject({
  rank: z.number().int().min(0).max(2),
  id: z.uuid(),
  kind: Kind,
});
export const ActionInboxQuerySchema = z.strictObject({
  after: Cursor.optional(),
});
export const ActionInboxPageSchema = z.strictObject({
  permissions: z.array(PermissionCodeSchema).max(29),
  items: z
    .array(
      z.strictObject({
        id: z.uuid(),
        kind: Kind,
        rank: z.number().int().min(0).max(2),
        order_id: z.uuid().nullable(),
        number: z
          .string()
          .regex(/^[1-9][0-9]*$/)
          .nullable(),
        clinic_name: z.string(),
        occurred_at: z.iso.datetime(),
        revision: RevisionSchema.min(1),
      }),
    )
    .max(50),
  next_after: Cursor.nullable(),
});
export type ActionInboxQuery = z.output<typeof ActionInboxQuerySchema>;
export type ActionInboxPage = z.output<typeof ActionInboxPageSchema>;
