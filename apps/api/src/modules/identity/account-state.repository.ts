import { randomUUID } from "node:crypto";
import {
  AccountStateFieldsSchema,
  AccountStateProfileSchema,
  AccountStateListSchema,
  AccountStateHistorySchema,
} from "@dental-lab/contracts";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { currentRequestCorrelation } from "../../shared/request-correlation.js";
import {
  hasEffectivePermission,
  isCurrentOwner,
} from "../permissions/index.js";
import type { PermissionContext } from "../permissions/index.js";
import { createAccountStateService } from "./account-state.service.js";
type Database = Pick<
  ReturnType<typeof createApplicationDatabase>,
  "transaction"
>;
type Actor = { accountId: string; sessionId: string };
type Profile = "employee" | "clinic";
type Row = PermissionContext & {
  id: string;
  revision: string;
  email: string;
  hasCredential: boolean;
  clinicId: string | null;
  clinicSuspended: boolean | null;
};
function authorized(actor: PermissionContext, profile: Profile) {
  return (
    isCurrentOwner(actor) ||
    hasEffectivePermission(
      actor,
      profile === "clinic" ? "clinics.manage" : "employees.suspend",
    )
  );
}
function fields(row: Row) {
  return AccountStateFieldsSchema.parse({
    lifecycle: row.lifecycle,
    security_locked: row.securityLocked,
    reset_required: row.resetRequired,
    clinic_suspended: row.clinicSuspended,
  });
}
export function createAccountStateRepository(database: Database) {
  async function current(
    tx: DatabaseExecutor,
    identity: Actor,
    targetId?: string,
  ) {
    await tx.query(
      "SELECT id FROM public.accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
      [[identity.accountId, ...(targetId ? [targetId] : [])]],
    );
    await tx.query("LOCK TABLE public.account_grants IN SHARE MODE");
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
   c.id AS "clinicId",c.suspended AS "clinicSuspended" FROM public.accounts a LEFT JOIN public.clinics c ON c.account_id=a.id
   WHERE a.id=ANY($1::uuid[])`,
      [[identity.accountId, ...(targetId ? [targetId] : [])]],
    );
    const actor = result.rows.find((r) => r.id === identity.accountId);
    if (
      !actor ||
      (!authorized(actor, "employee") && !authorized(actor, "clinic"))
    )
      return null;
    if (!targetId) return { actor, target: undefined, row: undefined };
    const row = result.rows.find((r) => r.id === targetId);
    if (
      !row ||
      row.id === identity.accountId ||
      !["employee", "clinic"].includes(row.profile) ||
      !authorized(actor, row.profile as Profile)
    )
      return null;
    if (row.profile === "clinic") {
      const clinic = await tx.query<{ suspended: boolean }>(
        "SELECT suspended FROM public.clinics WHERE id=$1 AND account_id=$2 FOR UPDATE",
        [row.clinicId, targetId],
      );
      if (clinic.rows.length !== 1)
        throw new Error("ACCOUNT_CLINIC_RELATION_INVALID");
      row.clinicSuspended = clinic.rows[0]!.suspended;
    }
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
  function project(actor: PermissionContext, row: Row) {
    return AccountStateProfileSchema.parse({
      id: row.id,
      profile: row.profile,
      revision: Number(row.revision),
      email: row.email,
      ...fields(row),
      can_secure: row.profile === "clinic" && isCurrentOwner(actor),
    });
  }
  return {
    loadCurrent: (actor: Actor, targetId: string) =>
      database.transaction(async (tx) => {
        const c = await current(tx, actor, targetId);
        return c?.target ? { actor: c.actor, target: c.target } : null;
      }),
    async applyAtomic(
      actor: Actor,
      input: {
        targetAccountId: string;
        expectedRevision: number;
        operation: "suspend" | "reactivate" | "secure_clinic";
      },
    ) {
      return database.transaction(async (tx) => {
        const c = await current(tx, actor, input.targetAccountId);
        if (!c?.target || !c.row) return "denied" as const;
        const target = c.target,
          row = c.row;
        const result = await createAccountStateService({
          loadCurrent: async () => ({ actor: c.actor, target }),
          applyAtomic: async (_actor, command) => {
            const plan = command.plan,
              revision = target.revision + 1;
            if (!Number.isSafeInteger(revision))
              throw new Error("ACCOUNT_REVISION_EXHAUSTED");
            const updated = await tx.query(
              "UPDATE public.accounts SET lifecycle=$2,security_locked=security_locked OR $3,credential_reset_required=credential_reset_required OR $3,revision=revision+1,auth_epoch=auth_epoch+1 WHERE id=$1 AND revision=$4 RETURNING id",
              [
                target.id,
                plan.nextLifecycle,
                plan.securityLocked === true,
                target.revision,
              ],
            );
            if (updated.rows.length !== 1)
              throw new Error("ACCOUNT_STATE_WRITE_FAILED");
            if (plan.clinicSuspended !== undefined)
              await tx.query(
                "UPDATE public.clinics SET suspended=$2,revision=revision+1 WHERE account_id=$1",
                [target.id, plan.clinicSuspended],
              );
            await tx.query(
              "UPDATE public.sessions SET revoked_at=GREATEST(clock_timestamp(),created_at) WHERE account_id=$1 AND revoked_at IS NULL",
              [target.id],
            );
            if (plan.revokePendingInvitations)
              await tx.query(
                "UPDATE public.invitations SET revoked_at=GREATEST(clock_timestamp(),created_at) WHERE account_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL",
                [target.id],
              );
            const previous = fields(row),
              next = AccountStateFieldsSchema.parse({
                ...previous,
                lifecycle: plan.nextLifecycle,
                security_locked:
                  row.securityLocked || plan.securityLocked === true,
                reset_required:
                  row.resetRequired || plan.resetRequired === true,
                clinic_suspended: plan.clinicSuspended ?? row.clinicSuspended,
              });
            const correlation = currentRequestCorrelation(),
              event = randomUUID();
            await tx.query(
              "INSERT INTO public.account_state_events(target_account_id,actor_id,operation,previous_revision,aggregate_revision,request_id,previous_state,next_state) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)",
              [
                target.id,
                actor.accountId,
                input.operation,
                target.revision,
                revision,
                correlation,
                JSON.stringify(previous),
                JSON.stringify(next),
              ],
            );
            await tx.query(
              "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,$2,'account',$3,$4,$5,$6::text[])",
              [
                actor.accountId,
                input.operation === "secure_clinic"
                  ? "CLINIC_ACCOUNT_SECURED"
                  : input.operation === "suspend"
                    ? "ACCOUNT_SUSPENDED"
                    : "ACCOUNT_REACTIVATED",
                target.id,
                correlation,
                revision,
                input.operation === "secure_clinic" ? [] : ["lifecycle"],
              ],
            );
            await tx.query(
              "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,actor_id,correlation_id) VALUES($1,'account_changed','account',$2,$3,$4,$5)",
              [event, target.id, revision, actor.accountId, correlation],
            );
            await tx.query(
              "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
              [event],
            );
            return "applied";
          },
        }).change(actor, {
          targetAccountId: input.targetAccountId,
          expectedRevision: input.expectedRevision,
          operation: input.operation,
        });
        return result.kind === "applied"
          ? ("applied" as const)
          : result.kind === "conflict"
            ? ("stale" as const)
            : ("denied" as const);
      });
    },
    async profile(actor: Actor, targetId: string) {
      return database.transaction(async (tx) => {
        const c = await current(tx, actor, targetId);
        return c?.row ? project(c.actor, c.row) : null;
      });
    },
    async list(actor: Actor, profile: Profile, after?: string) {
      return database.transaction(async (tx) => {
        const c = await current(tx, actor);
        if (!c || !authorized(c.actor, profile)) return null;
        const result = await tx.query<Row>(
          `SELECT a.id,a.profile,a.revision::text,a.email_original AS email,a.lifecycle,a.security_locked AS "securityLocked",a.credential_reset_required AS "resetRequired",c.suspended AS "clinicSuspended"
      FROM public.accounts a LEFT JOIN public.clinics c ON c.account_id=a.id WHERE a.profile=$1 AND ($2::uuid IS NULL OR a.id>$2) ORDER BY a.id LIMIT 51`,
          [profile, after ?? null],
        );
        const items = result.rows.slice(0, 50).map((r) => project(c.actor, r));
        return AccountStateListSchema.parse({
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
          "SELECT id,actor_id,aggregate_revision::text AS revision,operation,occurred_at,previous_state AS previous,next_state AS next FROM public.account_state_events WHERE target_account_id=$1 AND ($2::bigint IS NULL OR aggregate_revision<$2) ORDER BY aggregate_revision DESC LIMIT 51",
          [targetId, before ?? null],
        );
        const items = result.rows.slice(0, 50).map((r) => ({
          ...r,
          revision: Number(r.revision),
          occurred_at: r.occurred_at.toISOString(),
        }));
        return AccountStateHistorySchema.parse({
          items,
          next_before: result.rows.length > 50 ? items[49]?.revision : null,
        });
      });
    },
  };
}
export async function assertAccountStateStorageReady(
  database: DatabaseExecutor,
) {
  const result = await database.query<{ ready: boolean }>(
    `SELECT has_table_privilege(current_user,'public.account_state_events','SELECT') AND has_table_privilege(current_user,'public.account_state_events','INSERT') AND NOT has_table_privilege(current_user,'public.account_state_events','UPDATE,DELETE,TRUNCATE') AND has_column_privilege(current_user,'public.accounts','lifecycle','UPDATE') AND has_column_privilege(current_user,'public.accounts','security_locked','UPDATE') AND has_column_privilege(current_user,'public.accounts','credential_reset_required','UPDATE') AND has_column_privilege(current_user,'public.invitations','revoked_at','UPDATE') AND has_column_privilege(current_user,'public.clinics','revision','UPDATE') AND has_table_privilege(current_user,'public.account_grants','DELETE') AS ready`,
  );
  if (result.rows[0]?.ready !== true)
    throw new Error("ACCOUNT_STATE_STORAGE_NOT_READY");
}
