import type { createApplicationDatabase } from "../../shared/database.js";
import type { CredentialAccount } from "./authentication.service.js";

type Database = Pick<ReturnType<typeof createApplicationDatabase>, "query">;
export function createIdentityRepository(database: Database) {
  return {
    async findCredential(key: string): Promise<CredentialAccount | undefined> {
      const result = await database.query<CredentialAccount>(
        `SELECT a.id,a.profile,a.lifecycle,a.security_locked,a.credential_reset_required,
          a.auth_epoch::text AS auth_epoch,c.password_hash,
          CASE WHEN a.profile='clinic' THEN COALESCE(k.suspended,true) ELSE false END AS clinic_suspended
          FROM public.accounts a JOIN public.credentials c ON c.account_id=a.id
          LEFT JOIN public.clinics k ON k.account_id=a.id
          WHERE a.email_key=$1`,
        [key],
      );
      return result.rows[0];
    },
  };
}
