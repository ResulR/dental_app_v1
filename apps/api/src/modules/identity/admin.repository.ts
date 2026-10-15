import { randomUUID } from "node:crypto";
import {
  AdminFieldsSchema,
  AdminProfileSchema,
  AdminListSchema,
  AdminHistorySchema,
} from "@dental-lab/contracts";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { currentRequestCorrelation } from "../../shared/request-correlation.js";
import {
  validateGrantSet,
  permissionPrerequisites,
  isCurrentOwner,
} from "../permissions/index.js";
import type { PermissionContext } from "../permissions/index.js";
import { createAdminManagementService } from "./admin-management.service.js";
import { AdminCommandSchema } from "@dental-lab/contracts";
type Database = Pick<
  ReturnType<typeof createApplicationDatabase>,
  "transaction"
>;
type Actor = { accountId: string; sessionId: string };
type Row = PermissionContext & {
  id: string;
  revision: string;
  email: string;
  hasCredential: boolean;
  clinicId: string | null;
  clinicSuspended: boolean | null;
};
function authorized(actor: PermissionContext) {
  return isCurrentOwner(actor);
}
function fields(row: Row) {
  return AdminFieldsSchema.parse({
    lifecycle: row.lifecycle,
    security_locked: row.securityLocked,
    reset_required: row.resetRequired,
    permission_codes: row.grants,
  });
}
export function createAdminRepository(database: Database) {
  async function current(
    tx: DatabaseExecutor,
    identity: Actor,
    targetId?: string,
  ) {
    await tx.query(
      "SELECT id FROM public.accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
      [[identity.accountId, ...(targetId ? [targetId] : [])]],
    );
    await tx.query(
      "LOCK TABLE public.account_grants IN SHARE ROW EXCLUSIVE MODE",
    );
    const session = await tx.query(
      `SELECT s.id FROM public.sessions s JOIN public.accounts a ON a.id=s.account_id
   JOIN public.session_limits l ON l.session_id=s.id AND l.account_id=a.id WHERE s.id=$1 AND s.account_id=$2
   AND s.revoked_at IS NULL AND s.auth_epoch=a.auth_epoch AND s.created_at<=clock_timestamp()
   AND s.expires_at>clock_timestamp() AND l.expires_at=s.expires_at AND l.absolute_expires_at>=s.expires_at
   AND l.absolute_expires_at>clock_timestamp() FOR SHARE OF s`,
      [identity.sessionId, identity.accountId],
    );
    if (session.rows.length !== 1) return null;
    const result = await tx.query<Row>(
      `SELECT a.id,a.profile,a.lifecycle,a.revision::text,a.email_original AS email,
   a.security_locked AS "securityLocked",a.credential_reset_required AS "resetRequired",true AS "sessionValid",
   EXISTS(SELECT 1 FROM public.owner_slot o WHERE o.singleton=1 AND o.account_id=a.id) AS "ownerCurrent",
   EXISTS(SELECT 1 FROM public.credentials k WHERE k.account_id=a.id) AS "hasCredential",
   ARRAY(SELECT g.permission_code FROM public.account_grants g WHERE g.account_id=a.id ORDER BY g.permission_code) AS grants,
   NULL::uuid AS "clinicId",NULL::boolean AS "clinicSuspended" FROM public.accounts a
   WHERE a.id=ANY($1::uuid[])`,
      [[identity.accountId, ...(targetId ? [targetId] : [])]],
    );
    const actor = result.rows.find((r) => r.id === identity.accountId);
    if (!actor || !authorized(actor)) return null;
    if (!targetId) return { actor, target: undefined, row: undefined };
    const row = result.rows.find((r) => r.id === targetId);
    if (!row || row.id === identity.accountId || row.profile !== "admin")
      return null;
    return {
      actor,
      row,
      target: {
        id: row.id,
        profile: row.profile,
        revision: Number(row.revision),
        lifecycle: row.lifecycle,
        hasCredential: row.hasCredential,
        securityLocked: row.securityLocked,
        resetRequired: row.resetRequired,
      },
    };
  }
  function project(row: Row) {
    return AdminProfileSchema.parse({
      id: row.id,
      profile: row.profile,
      revision: Number(row.revision),
      email: row.email,
      ...fields(row),
    });
  }
  return {
    loadCurrent: (actor: Actor, targetId: string) =>
      database.transaction(async (tx) => {
        const c = await current(tx, actor, targetId);
        return c?.target ? { actor: c.actor, target: c.target } : null;
      }),
    async change(actor: Actor, targetId: string, raw: unknown) {
      const parsed = AdminCommandSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      const input = parsed.data;
      return database.transaction(async (tx) => {
        const c = await current(tx, actor, targetId);
        if (!c?.target || !c.row) return { kind: "denied" as const };
        const row = c.row,
          target = c.target;
        if (target.revision !== input.expected_revision)
          return { kind: "conflict" as const };
        if (input.operation === "reactivate" && target.securityLocked)
          return { kind: "recovery_required" as const };
        const nextLifecycle =
          input.operation === "suspend"
            ? "suspended"
            : input.operation === "reactivate"
              ? target.hasCredential
                ? "active"
                : "invited"
              : target.lifecycle;
        const proposed =
          input.operation === "permissions"
            ? input.permission_codes
            : fields(row).permission_codes;
        const result = await createAdminManagementService({
          authorizeOwner: async () => isCurrentOwner(c.actor),
          readTarget: async () => ({ id: targetId, profile: row.profile }),
          validatePermissions: async (codes) =>
            validateGrantSet(codes, "admin"),
          mutateAtomic: async () => {
            if (
              nextLifecycle === target.lifecycle &&
              proposed.length === row.grants.length &&
              proposed.every((code) => row.grants.includes(code))
            )
              return "applied";
            if (!Number.isSafeInteger(target.revision + 1))
              throw new Error("ADMIN_REVISION_EXHAUSTED");
            if (input.operation === "permissions") {
              await tx.query(
                "DELETE FROM public.account_grants WHERE account_id=$1 AND NOT(permission_code=ANY($2::text[]))",
                [targetId, proposed],
              );
              for (const code of proposed.filter(
                (code) => !row.grants.includes(code),
              ))
                await tx.query(
                  "INSERT INTO public.account_grants(account_id,account_profile,permission_code,prerequisite_key,created_by) VALUES($1,'admin',$2,$3,$4)",
                  [
                    targetId,
                    code,
                    permissionPrerequisites[code] ?? "",
                    actor.accountId,
                  ],
                );
            }
            const updated = await tx.query(
              "UPDATE public.accounts SET lifecycle=$2,revision=revision+1,auth_epoch=auth_epoch+1 WHERE id=$1 AND revision=$3 RETURNING id",
              [targetId, nextLifecycle, target.revision],
            );
            if (updated.rows.length !== 1)
              throw new Error("ADMIN_WRITE_FAILED");
            await tx.query(
              "UPDATE public.sessions SET revoked_at=GREATEST(clock_timestamp(),created_at) WHERE account_id=$1 AND revoked_at IS NULL",
              [targetId],
            );
            if (input.operation === "suspend")
              await tx.query(
                "UPDATE public.invitations SET revoked_at=GREATEST(clock_timestamp(),created_at) WHERE account_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL",
                [targetId],
              );
            const correlation = currentRequestCorrelation(),
              event = randomUUID();
            const previous = fields(row),
              next = {
                ...previous,
                lifecycle: nextLifecycle,
                permission_codes: proposed,
              };
            await tx.query(
              "INSERT INTO public.admin_management_events(target_account_id,actor_id,operation,previous_revision,aggregate_revision,request_id,previous_state,next_state) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)",
              [
                targetId,
                actor.accountId,
                input.operation,
                target.revision,
                target.revision + 1,
                correlation,
                JSON.stringify(previous),
                JSON.stringify(next),
              ],
            );
            await tx.query(
              "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,$2,'account',$3,$4,$5,$6::text[])",
              [
                actor.accountId,
                input.operation === "permissions"
                  ? "ADMIN_PERMISSIONS_CHANGED"
                  : input.operation === "suspend"
                    ? "ADMIN_SUSPENDED"
                    : "ADMIN_REACTIVATED",
                targetId,
                correlation,
                target.revision + 1,
                [
                  input.operation === "permissions"
                    ? "permissions"
                    : "lifecycle",
                ],
              ],
            );
            await tx.query(
              "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,actor_id,correlation_id) VALUES($1,$2,'account',$3,$4,$5,$6)",
              [
                event,
                input.operation === "permissions"
                  ? "permissions_changed"
                  : "account_changed",
                targetId,
                target.revision + 1,
                actor.accountId,
                correlation,
              ],
            );
            await tx.query(
              "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
              [event],
            );
            return "applied";
          },
        }).manage({ accountId: actor.accountId, profile: c.actor.profile }, {
          targetAccountId: targetId,
          expectedRevision: input.expected_revision,
          operation: input.operation,
          ...(input.operation === "permissions"
            ? { permissionCodes: input.permission_codes }
            : {}),
        } as Parameters<
          ReturnType<typeof createAdminManagementService>["manage"]
        >[1]);
        return result.kind === "applied"
          ? {
              kind: "applied" as const,
              recoveryRequired: target.resetRequired,
              invitationRequired:
                input.operation === "reactivate" && nextLifecycle === "invited",
            }
          : result;
      });
    },
    async profile(actor: Actor, targetId: string) {
      return database.transaction(async (tx) => {
        const c = await current(tx, actor, targetId);
        return c?.row ? project(c.row) : null;
      });
    },
    async list(actor: Actor, after?: string) {
      return database.transaction(async (tx) => {
        const c = await current(tx, actor);
        if (!c || !authorized(c.actor)) return null;
        const result = await tx.query<Row>(
          `SELECT a.id,a.profile,a.revision::text,a.email_original AS email,a.lifecycle,a.security_locked AS "securityLocked",a.credential_reset_required AS "resetRequired",NULL::boolean AS "clinicSuspended",ARRAY(SELECT permission_code FROM public.account_grants g WHERE g.account_id=a.id ORDER BY permission_code) AS grants
      FROM public.accounts a WHERE a.profile=$1 AND ($2::uuid IS NULL OR a.id>$2) ORDER BY a.id LIMIT 51`,
          ["admin", after ?? null],
        );
        const items = result.rows.slice(0, 50).map((r) => project(r));
        return AdminListSchema.parse({
          items,
          next_after: result.rows.length > 50 ? items[49]?.id : null,
        });
      });
    },
    async history(actor: Actor, targetId: string, before?: number) {
      return database.transaction(async (tx) => {
        if (!(await current(tx, actor, targetId))?.target) return null;
        const result = await tx.query<{
          id: string;
          actor_id: string;
          revision: string;
          operation: string;
          occurred_at: Date;
          previous: unknown;
          next: unknown;
        }>(
          "SELECT id,actor_id,aggregate_revision::text AS revision,operation,occurred_at,previous_state AS previous,next_state AS next FROM public.admin_management_events WHERE target_account_id=$1 AND ($2::bigint IS NULL OR aggregate_revision<$2) ORDER BY aggregate_revision DESC LIMIT 51",
          [targetId, before ?? null],
        );
        const items = result.rows.slice(0, 50).map((r) => ({
          ...r,
          revision: Number(r.revision),
          occurred_at: r.occurred_at.toISOString(),
        }));
        return AdminHistorySchema.parse({
          items,
          next_before: result.rows.length > 50 ? items[49]?.revision : null,
        });
      });
    },
  };
}
export async function assertAdminStorageReady(database: DatabaseExecutor) {
  const result = await database.query<{ ready: boolean }>(
    `SELECT has_table_privilege(current_user,'public.admin_management_events','SELECT') AND has_table_privilege(current_user,'public.admin_management_events','INSERT') AND NOT has_table_privilege(current_user,'public.admin_management_events','UPDATE,DELETE,TRUNCATE') AND has_column_privilege(current_user,'public.accounts','lifecycle','UPDATE') AND has_column_privilege(current_user,'public.invitations','revoked_at','UPDATE') AND has_table_privilege(current_user,'public.account_grants','SELECT') AND has_table_privilege(current_user,'public.account_grants','INSERT') AND has_table_privilege(current_user,'public.account_grants','DELETE') AS ready`,
  );
  if (result.rows[0]?.ready !== true)
    throw new Error("ADMIN_STORAGE_NOT_READY");
}
