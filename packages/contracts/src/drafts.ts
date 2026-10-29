import { z } from "zod";
import { ToothSchema } from "./schemas.js";

// A partial clinic form. Private file IDs remain outside this first text-only slice.
export const DraftPayloadSchema = z.strictObject({
  patient: z
    .strictObject({
      first_name: z.string().max(200).optional(),
      last_name: z.string().max(200).optional(),
      internal_reference: z.string().max(200).optional(),
    })
    .optional(),
  requested_delivery_date: z.string().max(32).optional(),
  material: z.uuid().optional(),
  shade: z.uuid().optional(),
  work_type: z.uuid().optional(),
  description: z.string().max(10000).optional(),
  teeth: z.array(ToothSchema).max(32).optional(),
});
export const DraftListQuerySchema = z.strictObject({
  after: z.uuid().optional(),
});
export const DraftQuerySchema = z.strictObject({ draft_id: z.uuid() });
export const DraftMutationSchema = z.strictObject({
  draft_id: z.uuid(),
  expected_revision: z.number().int().min(0).max(2147483647),
  idempotency_key: z.uuid(),
  payload: DraftPayloadSchema.optional(),
});
export const DraftSnapshotSchema = z.strictObject({
  draft_id: z.uuid(),
  revision: z.string().regex(/^[1-9][0-9]*$/),
  state: z.enum(["active", "deleted", "submitted"]),
  payload: DraftPayloadSchema.nullable(),
});
export const DraftListResultSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        draft_id: z.uuid(),
        revision: z.string().regex(/^[1-9][0-9]*$/),
      }),
    )
    .max(50),
  next_after: z.uuid().nullable(),
});
export const DraftCommitResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("committed"),
    revision: z.string().regex(/^[1-9][0-9]*$/),
    replayed: z.boolean(),
  }),
  z.strictObject({ kind: z.literal("conflict") }),
]);
