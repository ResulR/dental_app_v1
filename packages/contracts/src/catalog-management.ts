import { z } from "zod";
import { CatalogKindSchema } from "./catalog.js";
import { RevisionSchema } from "./schemas.js";
const label = z.string().trim().min(1).max(500);
export const CatalogCreateSchema = z.strictObject({
  kind: CatalogKindSchema,
  label,
});
export const CatalogEditSchema = z.discriminatedUnion("operation", [
  z.strictObject({
    operation: z.literal("restrict"),
    expected_revision: RevisionSchema.min(1),
    reason: z.string().trim().min(1).max(2000),
  }),
  z.strictObject({
    operation: z.literal("update"),
    expected_revision: RevisionSchema.min(1),
    label,
    is_active: z.boolean(),
    use_state: z.enum(["available", "unavailable"]),
  }),
  z.strictObject({
    operation: z.literal("remove"),
    expected_revision: RevisionSchema.min(1),
  }),
]);
export const CatalogManagedFieldsSchema = z.strictObject({
  label: z.string().min(1).nullable(),
  is_active: z.boolean().nullable(),
  use_state: z.enum(["available", "unavailable", "forbidden"]),
  forbidden_reason: z.string().nullable(),
});
export const CatalogManagedProfileSchema = CatalogManagedFieldsSchema.extend({
  id: z.uuid(),
  kind: CatalogKindSchema,
  revision: RevisionSchema.min(1),
});
export const CatalogManagedPageSchema = z.strictObject({
  items: z.array(CatalogManagedProfileSchema).max(50),
  next_after: z.uuid().nullable(),
});
export const CatalogMutationResultSchema = z.strictObject({
  kind: z.enum(["applied", "conflict", "denied", "invalid", "restricted"]),
  id: z.uuid().optional(),
});
export const CatalogHistorySchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.uuid(),
        actor_id: z.uuid(),
        revision: RevisionSchema.min(1),
        operation: z.enum(["create", "update", "remove", "restrict"]),
        occurred_at: z.iso.datetime(),
        previous: CatalogManagedFieldsSchema.nullable(),
        next: CatalogManagedFieldsSchema,
      }),
    )
    .max(50),
  next_before: RevisionSchema.min(1).nullable(),
});

export const CatalogImpactsSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.uuid(),
        number: z.string().regex(/^[1-9][0-9]*$/),
        clinic_id: z.uuid(),
        status: z.enum([
          "pending",
          "correction_requested",
          "rejected",
          "accepted",
          "manufacturing",
          "completed",
          "delivered",
          "cancelled",
        ]),
      }),
    )
    .max(50),
  next_after: z.uuid().nullable(),
});
