import { z } from "zod";
import { RevisionSchema } from "./schemas.js";
export const CatalogKindSchema = z.enum(["material", "shade", "work_type"]);
export const ActiveCatalogItemSchema = z.strictObject({
  id: z.uuid(),
  kind: CatalogKindSchema,
  label: z.string().min(1),
  revision: RevisionSchema.min(1),
});
export const ActiveCatalogPageSchema = z.strictObject({
  items: z.array(ActiveCatalogItemSchema).max(50),
  next_after: z.uuid().nullable(),
});
