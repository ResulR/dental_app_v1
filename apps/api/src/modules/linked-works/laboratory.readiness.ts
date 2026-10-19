import type { DatabaseExecutor } from "../../shared/database.js";
export async function assertLaboratoryLinkedReady(db: DatabaseExecutor) {
  const r = await db.query(
    "SELECT has_table_privilege(current_user,'public.work_links','SELECT') AND has_table_privilege(current_user,'public.work_links','INSERT') AND EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.work_links'::regclass AND conname='work_links_child_kind_fk' AND convalidated AND confupdtype='a') AND EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.work_links'::regclass AND conname='work_links_child_status_fk' AND convalidated AND confupdtype='c') AS ready",
  );
  if (r.rows[0]?.ready !== true)
    throw new Error("LABORATORY_LINKED_STORAGE_NOT_READY");
}
