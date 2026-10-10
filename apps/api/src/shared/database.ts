import { Pool } from "pg";
import type { PoolConfig, QueryResultRow } from "pg";

export function applicationPoolConfig(env: NodeJS.ProcessEnv): PoolConfig {
  const expected: Record<string, string> = {
    PGDATABASE: "dental_lab",
    PGHOST: "/var/run/postgresql",
    PGPORT: "5432",
    PGUSER: "dental-lab-runtime",
  };
  if (env.NODE_PG_FORCE_NATIVE !== undefined)
    throw new Error("INVALID_DATABASE_CONFIG");
  for (const [key, value] of Object.entries(env)) {
    if (
      key.startsWith("PG") &&
      (expected[key] === undefined || value !== expected[key])
    ) {
      throw new Error("INVALID_DATABASE_CONFIG");
    }
  }
  return {
    database: "dental_lab",
    user: "dental-lab-runtime",
    host: "/var/run/postgresql",
    port: 5432,
    ssl: false,
    password: () => {
      throw new Error("DATABASE_PASSWORD_AUTH_FORBIDDEN");
    },
    application_name: "dental-lab",
    options: "-c search_path=pg_catalog,public",
    max: 2,
    min: 0,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 5000,
    lock_timeout: 2000,
    idle_in_transaction_session_timeout: 10000,
    query_timeout: 7000,
  };
}

export const sessionCheckSql = `
SELECT current_database() AS database, current_user AS identity,
       session_user AS session_identity,
       current_setting('server_version_num')::integer AS version,
       r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication
         OR r.rolbypassrls AS administrative,
       has_database_privilege(current_user, current_database(), 'CREATE') AS db_create,
       has_database_privilege(current_user, current_database(), 'TEMP') AS db_temp,
       EXISTS (SELECT 1 FROM pg_namespace WHERE nspname !~ '^pg_'
          AND nspname <> 'information_schema'
          AND has_schema_privilege(current_user, oid, 'CREATE')) AS schema_create,
       pg_has_role(current_user, 'dental_lab_owner', 'MEMBER')
         OR pg_has_role(current_user, 'dental_lab_migrator', 'MEMBER')
         OR pg_has_role(current_user, 'dental_lab_audit', 'MEMBER') AS forbidden_membership,
       pg_has_role(current_user, 'dental_lab_app', 'MEMBER') AS app_membership,
       EXISTS (SELECT 1 FROM pg_roles other WHERE other.rolname NOT IN
          ('dental-lab-runtime','dental_lab_app')
          AND pg_has_role(current_user, other.oid, 'MEMBER')) AS unexpected_membership,
       EXISTS (SELECT 1 FROM pg_class c JOIN pg_roles owner ON owner.oid=c.relowner
          WHERE pg_has_role(current_user, owner.oid, 'MEMBER')) AS owned_objects
FROM pg_roles r WHERE r.rolname = current_user
`;

export function assertApplicationSession(
  row: Record<string, unknown> | undefined,
): void {
  if (
    !row ||
    row.database !== "dental_lab" ||
    row.identity !== "dental-lab-runtime" ||
    row.session_identity !== "dental-lab-runtime" ||
    typeof row.version !== "number" ||
    row.version < 170000 ||
    row.version >= 180000 ||
    row.administrative !== false ||
    row.db_create !== false ||
    row.db_temp !== false ||
    row.schema_create !== false ||
    row.forbidden_membership !== false ||
    row.app_membership !== true ||
    row.unexpected_membership !== false ||
    row.owned_objects !== false
  )
    throw new Error("DATABASE_IDENTITY_OR_PRIVILEGES_INVALID");
}

// No connection is opened at import or construction. Every checkout verifies the
// session before application SQL; no raw Pool is exposed to business modules.
export function createApplicationDatabase(
  env: NodeJS.ProcessEnv,
  onIdleError: (code: "DATABASE_IDLE_ERROR") => void = () => {
    process.stderr.write('{"event":"database_idle_error"}\n');
  },
) {
  applicationPoolConfig(process.env);
  const pool = new Pool(applicationPoolConfig(env));
  pool.on("error", () => onIdleError("DATABASE_IDLE_ERROR"));
  return {
    async query<Row extends QueryResultRow>(
      text: string,
      values: unknown[] = [],
    ) {
      const client = await pool.connect();
      let discard = false;
      try {
        const session = await client.query(sessionCheckSql);
        assertApplicationSession(
          session.rows[0] as Record<string, unknown> | undefined,
        );
        return await client.query<Row>(text, values);
      } catch (error) {
        discard = true;
        throw error;
      } finally {
        client.release(discard);
      }
    },
    async close() {
      await pool.end();
    },
  };
}
