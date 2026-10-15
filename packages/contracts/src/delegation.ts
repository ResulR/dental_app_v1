import { z } from "zod";
import { PermissionCodeSchema } from "./permissions.js";
import { RevisionSchema } from "./schemas.js";
export const DelegationKindSchema = z.enum(["employee", "envelope"]);
const codes = z.array(PermissionCodeSchema).max(29);
export const DelegationCommandSchema = z.strictObject({
  expected_revision: RevisionSchema.min(1),
  permission_codes: codes,
  confirmed_dropped_codes: codes.optional(),
});
export const DelegationListSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.uuid(),
        email: z.string().min(1).max(320),
        lifecycle: z.enum(["active", "invited", "suspended"]),
      }),
    )
    .max(50),
  next_after: z.uuid().nullable(),
});
export const DelegationProfileSchema = z.strictObject({
  id: z.uuid(),
  revision: RevisionSchema.min(1),
  email: z.string().min(1).max(320),
  permission_codes: codes,
  editable_codes: codes,
});
export const DelegationResultSchema = z.strictObject({
  kind: z.enum([
    "applied",
    "conflict",
    "denied",
    "invalid",
    "confirmation_required",
  ]),
  dropped_codes: codes.optional(),
});
export const DelegationHistorySchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.uuid(),
        actor_id: z.uuid(),
        revision: RevisionSchema.min(2),
        occurred_at: z.iso.datetime(),
        previous_codes: codes,
        next_codes: codes,
      }),
    )
    .max(50),
  next_before: RevisionSchema.min(1).nullable(),
});
export type DelegationKind = z.infer<typeof DelegationKindSchema>;
export type DelegationCommand = z.infer<typeof DelegationCommandSchema>;
export type DelegationProfile = z.infer<typeof DelegationProfileSchema>;
