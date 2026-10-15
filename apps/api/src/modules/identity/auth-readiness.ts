import type { createApplicationDatabase } from "../../shared/database.js";
const reads = [
  "accounts",
  "account_grants",
  "credentials",
  "clinics",
  "owner_slot",
  "sessions",
  "session_limits",
  "audit_events",
  "login_limit_guard",
  "login_attempt_limits",
  "outbox_events",
  "outbox_dispatches",
  "internal_notifications",
  "notification_deliveries",
];
const inserts = [
  "sessions",
  "session_limits",
  "audit_events",
  "login_attempt_limits",
  "outbox_events",
  "outbox_dispatches",
  "internal_notifications",
  "notification_deliveries",
];
const updates = [
  ["accounts", "auth_epoch"],
  ["accounts", "revision"],
  ["sessions", "revoked_at"],
  ["clinics", "suspended"],
  ["login_limit_guard", "policy_digest"],
  ["login_attempt_limits", "attempts"],
];
const all = (terms: string[]) => terms.join(" AND ");
export const authReadinessSql = `/* auth_readiness */ SELECT
  ${all(reads.map((table) => `has_table_privilege(current_user,'public.${table}','SELECT')`))} AS readable,
  ${all(inserts.map((table) => `has_table_privilege(current_user,'public.${table}','INSERT')`))} AS insertable,
  ${all(updates.map(([table, column]) => `has_column_privilege(current_user,'public.${table}','${column}','UPDATE')`))} AS updatable,
  has_table_privilege(current_user,'public.login_attempt_limits','DELETE') AS cleanup`;
export async function assertAuthStorageReady(
  database: Pick<ReturnType<typeof createApplicationDatabase>, "query">,
): Promise<void> {
  const result = await database.query<{
    readable: boolean;
    insertable: boolean;
    updatable: boolean;
    cleanup: boolean;
  }>(authReadinessSql);
  const row = result.rows[0];
  if (
    !row ||
    row.readable !== true ||
    row.insertable !== true ||
    row.updatable !== true ||
    row.cleanup !== true
  )
    throw new Error("AUTH_STORAGE_NOT_READY");
}
