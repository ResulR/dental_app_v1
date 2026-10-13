// Private administrative primitive. Never imported by the HTTP application.
import { randomUUID } from "node:crypto";
import {
  emailKey,
  assertAuthStorageReady,
} from "../apps/api/dist/modules/identity/index.js";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function validateApproval(value, now = Date.now()) {
  if (
    !value ||
    Object.keys(value).sort().join(",") !==
      "approvalId,email,expiresAt,purpose" ||
    value.purpose !== "first-owner-v1" ||
    !uuid.test(value.approvalId) ||
    typeof value.email !== "string" ||
    value.email !== value.email.trim() ||
    !emailKey(value.email) ||
    !Number.isSafeInteger(value.expiresAt) ||
    value.expiresAt <= now ||
    value.expiresAt > now + 3600000
  )
    throw new Error("BOOTSTRAP_APPROVAL_INVALID");
  return { ...value };
}
export function validatePrepared(value) {
  const approval = validateApproval(value?.approval);
  const match =
    typeof value?.passwordHash === "string" &&
    /^scrypt\$1\$131072\$8\$1\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{43})$/.exec(
      value.passwordHash,
    );
  if (
    !match ||
    Buffer.from(match[1], "base64url").toString("base64url") !== match[1] ||
    Buffer.from(match[2], "base64url").toString("base64url") !== match[2] ||
    Object.keys(value).sort().join(",") !== "approval,passwordHash"
  )
    throw new Error("BOOTSTRAP_INPUT_INVALID");
  return { approval, passwordHash: value.passwordHash };
}

// The caller owns a dedicated connection and MUST close it after any outcome.
// No retry, account promotion, UPDATE, DELETE, DDL, credential read or dynamic SQL.
export async function provisionFirstOwner(client, input) {
  const { approval, passwordHash } = validatePrepared(input);
  let began = false;
  let commitSent = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
    began = true;
    await client.query("SET LOCAL search_path = pg_catalog, public");
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '10s'");
    await client.query("SET LOCAL transaction_timeout = '15s'");
    await client.query("SET LOCAL synchronous_commit = on");
    // Keep statement/audit logging; omit sensitive bind values and error DETAIL.
    await client.query("SET LOCAL log_parameter_max_length = 0");
    await client.query("SET LOCAL log_parameter_max_length_on_error = 0");
    await client.query("SET LOCAL log_error_verbosity = terse");
    const identity = (
      await client.query(`SELECT current_database() = 'dental_lab'
      AND session_user = 'postgres' AND current_user = 'postgres'
      AND current_setting('server_version_num')::int / 10000 = 17
      AND current_setting('shared_preload_libraries') = ''
      AND current_setting('session_preload_libraries') = ''
      AND current_setting('local_preload_libraries') = ''
      AND NOT EXISTS (SELECT 1 FROM pg_stat_activity
        WHERE datname = current_database() AND usename = 'dental-lab-runtime')
      AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN
        ('dental_lab_migrator','dental-migrate') AND rolcanlogin) AS safe`)
    ).rows[0];
    if (identity?.safe !== true)
      throw new Error("BOOTSTRAP_ENVIRONMENT_INVALID");
    await client.query("SET LOCAL ROLE dental_lab_app");
    await assertAuthStorageReady(client);
    const acl = (
      await client.query(`SELECT
      NOT has_any_column_privilege(current_user,'public.owner_slot','INSERT,UPDATE')
      AND NOT has_table_privilege(current_user,'public.owner_slot','DELETE')
      AND NOT has_column_privilege(current_user,'public.accounts','profile','UPDATE')
      AND NOT has_any_column_privilege(current_user,'public.audit_events','UPDATE')
      AND NOT has_table_privilege(current_user,'public.audit_events','DELETE,TRUNCATE')
      AS safe`)
    ).rows[0];
    if (acl?.safe !== true) throw new Error("BOOTSTRAP_ACL_INVALID");
    // Existing migration role, transaction-local only. NOLOGIN is never changed.
    await client.query("SET LOCAL ROLE dental_lab_migrator");
    await client.query(
      "LOCK TABLE public.accounts, public.owner_slot, public.credentials, public.audit_events IN SHARE ROW EXCLUSIVE MODE",
    );
    const state = (
      await client.query(`SELECT
      NOT EXISTS (SELECT 1 FROM public.accounts)
      AND NOT EXISTS (SELECT 1 FROM public.owner_slot)
      AND NOT EXISTS (SELECT 1 FROM public.credentials)
      AND NOT EXISTS (SELECT 1 FROM public.audit_events WHERE process_code = 'owner_bootstrap')
      AS empty`)
    ).rows[0];
    if (state?.empty !== true) throw new Error("BOOTSTRAP_ALREADY_INITIALIZED");
    validateApproval(approval); // Expiry rechecked after lock acquisition.
    const accountId = randomUUID();
    await client.query(
      `INSERT INTO public.accounts
      (id,profile,email_original,email_key,lifecycle)
      VALUES ($1,'owner',$2,$3,'active')`,
      [accountId, approval.email, emailKey(approval.email)],
    );
    await client.query(
      "INSERT INTO public.owner_slot(singleton,account_id) VALUES (1,$1)",
      [accountId],
    );
    await client.query(
      "INSERT INTO public.credentials(account_id,password_hash) VALUES ($1,$2)",
      [accountId, passwordHash],
    );
    await client.query(
      `INSERT INTO public.audit_events
      (process_code,action,object_type,object_id,request_id,aggregate_revision)
      VALUES ('owner_bootstrap','OWNER_BOOTSTRAPPED','account',$1,$2,1)`,
      [accountId, approval.approvalId],
    );
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
    const verified = (
      await client.query(
        `SELECT count(*)::int = 1 AS valid
      FROM public.accounts a JOIN public.owner_slot o ON o.account_id=a.id
      JOIN public.credentials c ON c.account_id=a.id
      JOIN public.audit_events e ON e.object_id=a.id
        AND e.process_code='owner_bootstrap' AND e.action='OWNER_BOOTSTRAPPED'
      WHERE a.id=$1 AND a.profile='owner' AND a.lifecycle='active'
        AND NOT a.security_locked AND NOT a.credential_reset_required
        AND a.auth_epoch=0 AND a.revision=1 AND o.singleton=1
        AND e.request_id=$2 AND e.aggregate_revision=1`,
        [accountId, approval.approvalId],
      )
    ).rows[0];
    if (verified?.valid !== true)
      throw new Error("BOOTSTRAP_POSTCONDITION_FAILED");
    validateApproval(approval);
    commitSent = true;
    await client.query("COMMIT");
    return { outcome: "committed", approvalId: approval.approvalId, accountId };
  } catch {
    if (commitSent) throw new Error("BOOTSTRAP_COMMIT_UNCERTAIN");
    if (began) {
      try {
        await client.query("ROLLBACK");
      } catch {
        throw new Error("BOOTSTRAP_ROLLBACK_UNCERTAIN");
      }
    }
    throw new Error("BOOTSTRAP_REFUSED_OR_ROLLED_BACK");
  }
}
