import { z } from "zod";

// Additive contract in version 3. An announcement never activates maintenance.
export const MaintenanceNoticeSchema = z.strictObject({
  active: z.boolean(),
  message: z.string(),
  planned_at: z.iso.datetime().nullable(),
  planned_message: z.string(),
});
export const MaintenanceStateSchema = MaintenanceNoticeSchema.extend({
  revision: z.number().int().nonnegative(),
});
export const MaintenanceCommandSchema = MaintenanceStateSchema.omit({
  revision: true,
})
  .extend({
    expected_revision: z.number().int().nonnegative(),
    message: z.string().trim().max(2000),
    planned_message: z.string().trim().max(2000),
  })
  .refine(
    (value) =>
      (!value.active || value.message.length > 0) &&
      (value.planned_at === null || value.planned_message.length > 0),
  );
export type MaintenanceNotice = z.output<typeof MaintenanceNoticeSchema>;
export type MaintenanceState = z.output<typeof MaintenanceStateSchema>;
