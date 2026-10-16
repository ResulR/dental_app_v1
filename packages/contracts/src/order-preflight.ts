import { z } from "zod";
import {
  ClinicSubmissionSchema,
  PatientSchema,
  RevisionSchema,
} from "./schemas.js";
import { CatalogKindSchema } from "./catalog.js";
export const OrderPreflightInputSchema = ClinicSubmissionSchema.extend({
  patient: PatientSchema.refine(
    (p) => (p.first_name === undefined) === (p.last_name === undefined),
  ),
  material_id: z.uuid(),
  shade_id: z.uuid(),
  work_type_id: z.uuid().optional(),
  description: z.string().max(10000).optional(),
  file_ids: z.array(z.uuid()).refine((ids) => new Set(ids).size === ids.length),
});
export const OrderPreflightResultSchema = z.strictObject({
  persisted: z.literal(false),
  status: z.enum(["checked", "blocked"]),
  reasons: z.array(
    z.enum(["catalog_forbidden", "catalog_missing", "files_not_ready"]),
  ),
  warnings: z.array(z.enum(["catalog_unavailable", "low_detail"])),
  references: z
    .array(
      z.strictObject({
        id: z.uuid(),
        kind: CatalogKindSchema,
        label: z.string().nullable(),
        revision: RevisionSchema.min(1),
        state: z.enum(["available", "unavailable", "forbidden"]),
      }),
    )
    .max(3),
});
