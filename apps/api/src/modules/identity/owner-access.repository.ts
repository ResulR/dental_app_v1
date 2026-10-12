import type { createApplicationDatabase } from "../../shared/database.js";
import type { PermissionContext } from "../permissions/index.js";
import type { OwnerActorRef } from "./owner-access.service.js";

type Database = Pick<ReturnType<typeof createApplicationDatabase>, "query">;
type Row = Omit<PermissionContext, "grants">;

// Read-only current context; requires received 0010 grants and 0011 session limits.
// Does not authenticate a secret: caller must first verify the session cookie.
// A standalone read is NOT a lock or an authorization for a later mutation.
export function createOwnerAccessRepository(database: Database) {
  return {
    async loadCurrent(actor: OwnerActorRef): Promise<PermissionContext | null> {
      const result = await database.query<Row>(
        `SELECT a.profile, a.lifecycle,
           a.security_locked AS "securityLocked",
           a.credential_reset_required AS "resetRequired",
           true AS "sessionValid",
           EXISTS (SELECT 1 FROM public.owner_slot o
             WHERE o.singleton=1 AND o.account_id=a.id) AS "ownerCurrent"
         FROM public.accounts a
         JOIN public.sessions s ON s.account_id=a.id
         JOIN public.session_limits l ON l.session_id=s.id AND l.account_id=a.id
         WHERE a.id=$1::uuid AND s.id=$2::uuid
           AND s.revoked_at IS NULL AND s.auth_epoch=a.auth_epoch
           AND s.created_at <= statement_timestamp()
           AND s.expires_at > statement_timestamp()
           AND l.expires_at=s.expires_at
           AND l.absolute_expires_at >= s.expires_at
           AND l.absolute_expires_at > statement_timestamp()`,
        [actor.accountId, actor.sessionId],
      );
      if (result.rows.length !== 1) return null;
      return { ...result.rows[0]!, grants: [] };
    },
  };
}
