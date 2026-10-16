import type { DatabaseExecutor } from "../../shared/database.js";
import { OrderPreflightResultSchema } from "@dental-lab/contracts";
type Selection = {
  material_id: string;
  shade_id: string;
  work_type_id?: string | undefined;
};
// The caller owns the transaction. Locks survive through future order writes.
// Always acquire sorted reference locks BEFORE an order lock.
export async function readCatalogForUse(
  tx: DatabaseExecutor,
  selection: Selection,
) {
  const expected = new Map([
    [selection.material_id, "material"],
    [selection.shade_id, "shade"],
    ...(selection.work_type_id ? [[selection.work_type_id, "work_type"]] : []),
  ] as [string, string][]);
  const count = selection.work_type_id ? 3 : 2;
  if (expected.size !== count) return { missing: true, references: [] };
  const ids = [...expected.keys()].sort();
  await tx.query(
    "SELECT id FROM public.catalog_references WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE",
    [ids],
  );
  const result = await tx.query(
    "SELECT id,kind,label,revision::text,effective_use_state AS state FROM public.catalog_effective_states WHERE id=ANY($1::uuid[]) ORDER BY id",
    [ids],
  );
  const references = OrderPreflightResultSchema.shape.references.parse(
    result.rows.map((row) => ({ ...row, revision: Number(row.revision) })),
  );
  return {
    missing:
      references.length !== count ||
      references.some((row) => expected.get(row.id) !== row.kind),
    references,
  };
}
