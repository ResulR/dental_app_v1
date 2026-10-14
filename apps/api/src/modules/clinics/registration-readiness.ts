import type { DatabaseExecutor } from "../../shared/database.js";
export async function assertRegistrationStorageReady(
  database: DatabaseExecutor,
) {
  const result = await database.query<{
    ready: boolean;
  }>(`/* registration_readiness */
    SELECT
      has_table_privilege(current_user,'public.registration_terms_versions','SELECT')
      AND has_table_privilege(current_user,'public.registration_current_terms','SELECT')
      AND has_table_privilege(current_user,'public.clinic_terms_acceptances','SELECT')
      AND has_column_privilege(current_user,'public.registration_current_terms','singleton','UPDATE')
      AND NOT has_column_privilege(current_user,'public.registration_current_terms','version_id','UPDATE')
      AND NOT has_table_privilege(current_user,'public.registration_terms_versions','INSERT,UPDATE,DELETE')
      AND NOT has_table_privilege(current_user,'public.clinic_terms_acceptances','UPDATE,DELETE')
      AND has_column_privilege(current_user,'public.clinic_terms_acceptances','account_id','INSERT')
      AND has_column_privilege(current_user,'public.clinic_terms_acceptances','terms_version_id','INSERT')
      AND has_column_privilege(current_user,'public.accounts','id','INSERT')
      AND has_column_privilege(current_user,'public.accounts','profile','INSERT')
      AND has_column_privilege(current_user,'public.accounts','email_original','INSERT')
      AND has_column_privilege(current_user,'public.accounts','email_key','INSERT')
      AND has_column_privilege(current_user,'public.accounts','lifecycle','INSERT')
      AND has_table_privilege(current_user,'public.clinics','INSERT')
      AND has_table_privilege(current_user,'public.credentials','INSERT')
      AND has_table_privilege(current_user,'public.conversations','INSERT')
      AND has_table_privilege(current_user,'public.audit_events','INSERT')
      AND has_table_privilege(current_user,'public.outbox_events','INSERT')
      AND has_table_privilege(current_user,'public.outbox_dispatches','INSERT')
      AS ready`);
  if (result.rows.length !== 1 || result.rows[0]?.ready !== true)
    throw new Error("REGISTRATION_STORAGE_NOT_READY");
}
