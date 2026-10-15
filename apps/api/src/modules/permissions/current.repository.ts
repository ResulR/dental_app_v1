import type { createApplicationDatabase } from "../../shared/database.js";
import { EffectivePermissionsSchema } from "@dental-lab/contracts";
import { effectivePermissionCodes } from "./permissions.js";
import type { PermissionContext } from "./permissions.js";
type Actor = { accountId: string; sessionId: string };
// Single read snapshot only. Never an authorization or lock for a later write.
export function createCurrentPermissionsRepository(
  database: Pick<ReturnType<typeof createApplicationDatabase>, "query">,
) {
  return {
    async current(actor: Actor) {
      const result = await database.query<PermissionContext>(
        `SELECT a.profile,a.lifecycle,a.security_locked AS "securityLocked",
        a.credential_reset_required AS "resetRequired",true AS "sessionValid",
        EXISTS(SELECT 1 FROM public.owner_slot o WHERE o.singleton=1 AND o.account_id=a.id) AS "ownerCurrent",
        c.id AS "clinicId",c.suspended AS "clinicSuspended",
        ARRAY(SELECT g.permission_code FROM public.account_grants g WHERE g.account_id=a.id ORDER BY g.permission_code) AS grants
        FROM public.accounts a
        JOIN public.sessions s ON s.account_id=a.id
        JOIN public.session_limits l ON l.session_id=s.id AND l.account_id=a.id
        LEFT JOIN public.clinics c ON c.account_id=a.id
        WHERE a.id=$1::uuid AND s.id=$2::uuid
        AND s.revoked_at IS NULL AND s.auth_epoch=a.auth_epoch
        AND s.created_at<=statement_timestamp() AND s.expires_at>statement_timestamp()
        AND l.expires_at=s.expires_at AND l.absolute_expires_at>=s.expires_at
        AND l.absolute_expires_at>statement_timestamp()`,
        [actor.accountId, actor.sessionId],
      );
      const context = result.rows.length === 1 ? result.rows[0] : undefined;
      if (
        !context ||
        context.lifecycle !== "active" ||
        context.securityLocked !== false ||
        context.resetRequired !== false ||
        (context.profile === "clinic" &&
          (!context.clinicId || context.clinicSuspended !== false)) ||
        (context.profile === "owner" && context.ownerCurrent !== true)
      )
        return null;
      return EffectivePermissionsSchema.parse({
        account_id: actor.accountId,
        profile: context.profile,
        permissions: effectivePermissionCodes(context),
      });
    },
  };
}
