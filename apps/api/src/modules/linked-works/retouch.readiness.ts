import type { DatabaseExecutor } from "../../shared/database.js";
export async function assertRetouchReady(db: DatabaseExecutor) {
  const r = await db.query(
    "SELECT has_table_privilege(current_user,'public.work_links','SELECT') AND has_table_privilege(current_user,'public.work_links','INSERT') AND EXISTS(SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('public.work_links_one_active_retouch_idx') AND indisvalid AND indisunique) AS ready",
  );
  if (r.rows[0]?.ready !== true) throw new Error("RETOUCH_STORAGE_NOT_READY");
}
