import { z } from "zod";
import { RevisionSchema } from "./schemas.js";
export const ManagedProfileSchema = z.enum(["employee", "clinic"]);
export const AccountStateCommandSchema = z.strictObject({
  expected_revision: RevisionSchema.min(1),
  operation: z.enum(["suspend", "reactivate", "secure_clinic"]),
});
export const AccountStateFieldsSchema = z.strictObject({
  lifecycle: z.enum(["active", "invited", "suspended"]),
  security_locked: z.boolean(),
  reset_required: z.boolean(),
  clinic_suspended: z.boolean().nullable(),
});
export const AccountStateProfileSchema = AccountStateFieldsSchema.extend({
  id: z.uuid(),
  profile: ManagedProfileSchema,
  revision: RevisionSchema.min(1),
  email: z.string().min(1).max(320),
  can_secure: z.boolean(),
});
export const AccountStateListSchema = z.strictObject({
  items: z.array(AccountStateProfileSchema).max(50),
  next_after: z.uuid().nullable(),
});
export const AccountStateResultSchema = z.strictObject({
  kind: z.enum([
    "applied",
    "conflict",
    "denied",
    "invalid",
    "recovery_required",
  ]),
  recoveryRequired: z.boolean().optional(),
  invitationRequired: z.boolean().optional(),
});
export const AccountStateHistorySchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.uuid(),
        actor_id: z.uuid(),
        revision: RevisionSchema.min(2),
        operation: AccountStateCommandSchema.shape.operation,
        occurred_at: z.iso.datetime(),
        previous: AccountStateFieldsSchema,
        next: AccountStateFieldsSchema,
      }),
    )
    .max(50),
  next_before: RevisionSchema.min(1).nullable(),
});
