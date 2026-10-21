import { z } from "zod";
export const AuditLogQuerySchema = z.strictObject({
  action: z
    .string()
    .regex(/^[A-Z_]{1,80}$/)
    .optional(),
  object_type: z
    .enum([
      "order",
      "clinic",
      "account",
      "catalog_reference",
      "conversation",
      "message",
      "file",
      "draft",
      "settings",
      "process",
    ])
    .optional(),
  before: z
    .strictObject({ occurred_at: z.iso.datetime(), id: z.uuid() })
    .optional(),
});
const Entry = z.strictObject({
  id: z.uuid(),
  occurred_at: z.iso.datetime(),
  actor_id: z.uuid().nullable(),
  process_code: z.string().nullable(),
  action: z.string(),
  object_type: z.string(),
  object_id: z.uuid(),
  request_id: z.uuid(),
  aggregate_revision: z.number().int().positive().nullable(),
  reason_code: z.string().nullable(),
  changed_fields: z.array(z.string()),
});
export const AuditLogPageSchema = z.strictObject({
  items: z.array(Entry).max(50),
  next_before: z
    .strictObject({ occurred_at: z.iso.datetime(), id: z.uuid() })
    .nullable(),
});
