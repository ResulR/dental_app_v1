import type { DatabaseExecutor } from "../../shared/database.js";
export async function assertOrderSubmissionReady(database: DatabaseExecutor) {
  const tables = [
    "catalog_reference_snapshots",
    "order_versions",
    "order_version_teeth",
    "order_logistics",
    "order_status_events",
    "conversations",
    "conversation_reads",
    "message_reminder_cycles",
    "outbox_events",
    "outbox_dispatches",
    "audit_events",
    "submission_receipts",
  ];
  const result = await database.query(
    `SELECT bool_and(to_regclass('public.'||name) IS NOT NULL AND has_table_privilege(current_user,'public.'||name,'SELECT') AND has_table_privilege(current_user,'public.'||name,'INSERT')) AS ready FROM unnest($1::text[]) AS t(name)`,
    [tables],
  );
  if (result.rows[0]?.ready !== true)
    throw new Error("ORDER_SUBMISSION_STORAGE_NOT_READY");
  const columns = [
    "id",
    "clinic_id",
    "kind",
    "origin",
    "created_by",
    "status",
    "revision",
    "current_version_id",
  ];
  const orders = await database.query(
    `SELECT bool_and(has_column_privilege(current_user,'public.orders',name,'INSERT')) AND has_table_privilege(current_user,'public.orders','SELECT') AS ready FROM unnest($1::text[]) AS t(name)`,
    [columns],
  );
  if (orders.rows[0]?.ready !== true)
    throw new Error("ORDER_SUBMISSION_STORAGE_NOT_READY");
}
