import { z } from "zod";
import { RevisionSchema } from "./schemas.js";
const base = {
  order_id: z.uuid(),
  expected_version_id: z.uuid(),
  expected_revision: RevisionSchema.min(1),
};
export const OrderDecisionSchema = z.discriminatedUnion("action", [
  z.strictObject({
    ...base,
    action: z.literal("accept"),
    confirm_unavailable: z.boolean(),
    reason: z.string().trim().min(1).max(2000).optional(),
  }),
  z.strictObject({
    ...base,
    action: z.literal("reject"),
    reason: z.string().trim().min(1).max(2000),
  }),
  z.strictObject({ ...base, action: z.literal("start_manufacturing") }),
]);
export const OrderDecisionResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("updated"),
    order_id: z.uuid(),
    status: z.enum(["accepted", "rejected", "manufacturing"]),
    revision: RevisionSchema.min(1),
    version_id: z.uuid(),
  }),
  z.strictObject({ kind: z.literal("conflict") }),
  z.strictObject({ kind: z.literal("exception_required") }),
  z.strictObject({
    kind: z.literal("blocked"),
    reason: z.enum([
      "catalog_forbidden",
      "catalog_missing",
      "security_block",
      "pending_request",
      "files_not_ready",
    ]),
  }),
]);
