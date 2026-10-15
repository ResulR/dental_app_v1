import { z } from "zod";
import { RevisionSchema } from "./schemas.js";
import { PermissionCodeSchema } from "./permissions.js";
import { AccountStateResultSchema } from "./account-state.js";
const codes = z.array(PermissionCodeSchema).max(29);
export const AdminCommandSchema = z.discriminatedUnion("operation", [
  z.strictObject({
    expected_revision: RevisionSchema.min(1),
    operation: z.enum(["suspend", "reactivate"]),
  }),
  z.strictObject({
    expected_revision: RevisionSchema.min(1),
    operation: z.literal("permissions"),
    permission_codes: codes,
  }),
]);
export const AdminFieldsSchema = z.strictObject({
  lifecycle: z.enum(["active", "invited", "suspended"]),
  security_locked: z.boolean(),
  reset_required: z.boolean(),
  permission_codes: codes,
});
export const AdminProfileSchema = AdminFieldsSchema.extend({
  id: z.uuid(),
  profile: z.literal("admin"),
  revision: RevisionSchema.min(1),
  email: z.string().min(1).max(320),
});
export const AdminListSchema = z.strictObject({
  items: z.array(AdminProfileSchema).max(50),
  next_after: z.uuid().nullable(),
});
export const AdminResultSchema = AccountStateResultSchema;
export const AdminHistorySchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.uuid(),
        actor_id: z.uuid(),
        revision: RevisionSchema.min(2),
        operation: z.enum(["suspend", "reactivate", "permissions"]),
        occurred_at: z.iso.datetime(),
        previous: AdminFieldsSchema,
        next: AdminFieldsSchema,
      }),
    )
    .max(50),
  next_before: RevisionSchema.min(1).nullable(),
});
