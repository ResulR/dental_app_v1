import type { DatabaseExecutor } from "../../shared/database.js";
export async function assertDraftSyncReady(database: DatabaseExecutor) {
  const tables = [
    "drafts",
    "draft_revisions",
    "draft_sync_receipts",
    "clinics",
  ];
  const result = await database.query<{ ready: boolean }>(
    `SELECT bool_and(to_regclass('public.'||name) IS NOT NULL
      AND has_table_privilege(current_user,'public.'||name,'SELECT')
      AND has_table_privilege(current_user,'public.'||name,'INSERT')) AS ready
      FROM unnest($1::text[]) AS t(name)`,
    [tables],
  );
  if (result.rows[0]?.ready !== true)
    throw new Error("DRAFT_SYNC_STORAGE_NOT_READY");
  const changes = await database.query<{ ready: boolean }>(
    `SELECT has_column_privilege(current_user,'public.drafts','revision','UPDATE')
       AND has_column_privilege(current_user,'public.drafts','state','UPDATE')
       AND has_column_privilege(current_user,'public.drafts','deleted_at','UPDATE') AS ready`,
  );
  if (changes.rows[0]?.ready !== true)
    throw new Error("DRAFT_SYNC_STORAGE_NOT_READY");
}
