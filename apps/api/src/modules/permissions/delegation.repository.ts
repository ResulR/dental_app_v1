import { randomUUID } from "node:crypto";
import {
  DelegationCommandSchema,
  DelegationHistorySchema,
  DelegationListSchema,
  DelegationProfileSchema,
} from "@dental-lab/contracts";
import type { DelegationKind, DelegationCommand } from "@dental-lab/contracts";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { currentRequestCorrelation } from "../../shared/request-correlation.js";
import {
  effectivePermissionCodes,
  grantableCode,
  hasEffectivePermission,
  isCurrentOwner,
  permissionPrerequisites,
} from "./permissions.js";
import type { PermissionContext, PermissionCode } from "./permissions.js";
import { planEmployeeGrantChange } from "./delegation.service.js";
type Database = Pick<
  ReturnType<typeof createApplicationDatabase>,
  "transaction"
>;
type Actor = { accountId: string; sessionId: string };
type Row = PermissionContext & { id: string; revision: string; email: string };
const equal = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));
const validCodes = (codes: readonly string[]) =>
  new Set(codes).size === codes.length &&
  codes.every((c) => grantableCode("employee", c));
const targetRole = (kind: DelegationKind) =>
  kind === "employee" ? "employee" : "admin";
function allowed(actor: PermissionContext, kind: DelegationKind) {
  return (
    isCurrentOwner(actor) ||
    (kind === "employee" &&
      actor.profile === "admin" &&
      hasEffectivePermission(actor, "employees.manage_permissions"))
  );
}
export function createDelegationRepository(database: Database) {
  async function context(
    tx: DatabaseExecutor,
    identity: Actor,
    kind: DelegationKind,
    targetId?: string,
  ) {
    // Stable account order, then grants/envelope locks, then session. No unlocked fallback.
    await tx.query(
      "SELECT id FROM public.accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
      [[identity.accountId, ...(targetId ? [targetId] : [])]],
    );
    await tx.query(
      "LOCK TABLE public.account_grants,public.employee_delegation_limits IN SHARE ROW EXCLUSIVE MODE",
    );
    const session = await tx.query(
      `SELECT s.id FROM public.sessions s JOIN public.accounts a ON a.id=s.account_id
    JOIN public.session_limits l ON l.session_id=s.id AND l.account_id=a.id
    WHERE s.id=$1 AND s.account_id=$2 AND s.revoked_at IS NULL AND s.auth_epoch=a.auth_epoch
    AND s.created_at<=clock_timestamp() AND s.expires_at>clock_timestamp()
    AND l.expires_at=s.expires_at AND l.absolute_expires_at>=s.expires_at AND l.absolute_expires_at>clock_timestamp()
    FOR SHARE OF s`,
      [identity.sessionId, identity.accountId],
    );
    if (session.rows.length !== 1) return null;
    const accounts = await tx.query<Row>(
      `SELECT a.id,a.profile,a.lifecycle,a.revision::text,a.email_original AS email,
    a.security_locked AS "securityLocked",a.credential_reset_required AS "resetRequired",true AS "sessionValid",
    EXISTS(SELECT 1 FROM public.owner_slot o WHERE o.singleton=1 AND o.account_id=a.id) AS "ownerCurrent",
    ARRAY(SELECT g.permission_code FROM public.account_grants g WHERE g.account_id=a.id ORDER BY g.permission_code) AS grants
    FROM public.accounts a WHERE a.id=ANY($1::uuid[])`,
      [[identity.accountId, ...(targetId ? [targetId] : [])]],
    );
    const actor = accounts.rows.find((a) => a.id === identity.accountId);
    if (!actor || !allowed(actor, kind)) return null;
    const envelope = await tx.query<{ permission_code: string }>(
      "SELECT permission_code FROM public.employee_delegation_limits WHERE delegator_account_id=$1 ORDER BY permission_code",
      [identity.accountId],
    );
    const codes = envelope.rows.map((r) => r.permission_code);
    if (!isCurrentOwner(actor) && !validCodes(codes)) return null;
    if (!targetId) return { actor, envelope: codes, target: undefined };
    const row = accounts.rows.find((a) => a.id === targetId);
    if (
      !row ||
      row.id === identity.accountId ||
      row.profile !== targetRole(kind)
    )
      return null;
    let grants = Array.from(row.grants);
    if (kind === "envelope") {
      const result = await tx.query<{ permission_code: string }>(
        "SELECT permission_code FROM public.employee_delegation_limits WHERE delegator_account_id=$1 ORDER BY permission_code",
        [targetId],
      );
      grants = result.rows.map((r) => r.permission_code);
    }
    if (!validCodes(grants)) throw new Error("DELEGATION_STORED_CODES_INVALID");
    return {
      actor,
      envelope: codes,
      target: {
        id: row.id,
        profile: row.profile,
        revision: Number(row.revision),
        email: row.email,
        grants,
      },
    };
  }
  async function record(
    tx: DatabaseExecutor,
    actor: Actor,
    kind: DelegationKind,
    targetId: string,
    revision: number,
    before: readonly string[],
    after: readonly string[],
  ) {
    const correlation = currentRequestCorrelation(),
      event = randomUUID();
    await tx.query(
      "INSERT INTO public.delegation_events(target_account_id,actor_id,kind,previous_revision,aggregate_revision,request_id,previous_codes,next_codes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        targetId,
        actor.accountId,
        kind,
        revision,
        revision + 1,
        correlation,
        before,
        after,
      ],
    );
    await tx.query(
      "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,$2,'account',$3,$4,$5,ARRAY['permissions'])",
      [
        actor.accountId,
        kind === "employee"
          ? "EMPLOYEE_PERMISSIONS_CHANGED"
          : "EMPLOYEE_DELEGATION_CHANGED",
        targetId,
        correlation,
        revision + 1,
      ],
    );
    await tx.query(
      "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,actor_id,correlation_id) VALUES($1,'permissions_changed','account',$2,$3,$4,$5)",
      [event, targetId, revision + 1, actor.accountId, correlation],
    );
    await tx.query(
      "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
      [event],
    );
  }
  async function apply(
    actor: Actor,
    kind: DelegationKind,
    targetId: string,
    input: DelegationCommand,
  ): Promise<"applied" | "stale" | "denied"> {
    const parsed = DelegationCommandSchema.parse(input);
    if (
      !validCodes(parsed.permission_codes) ||
      !validCodes(parsed.confirmed_dropped_codes ?? [])
    )
      return "denied";
    return database.transaction(async (tx) => {
      const current = await context(tx, actor, kind, targetId);
      if (!current?.target) return "denied";
      const target = current.target;
      if (target.revision !== parsed.expected_revision) return "stale";
      let proposed: readonly PermissionCode[] = parsed.permission_codes;
      if (kind === "employee") {
        const plan = planEmployeeGrantChange(
          current.actor,
          current.envelope,
          target.grants,
          parsed.permission_codes,
        );
        if (
          plan.kind !== "ready" ||
          !equal(plan.dropped, parsed.confirmed_dropped_codes ?? [])
        )
          return "denied";
        proposed = plan.permissions;
      } else if ((parsed.confirmed_dropped_codes ?? []).length) return "denied";
      if (equal(target.grants, proposed)) return "applied";
      if (!Number.isSafeInteger(target.revision + 1))
        throw new Error("ACCOUNT_REVISION_EXHAUSTED");
      // Preserve attribution of unchanged grants, including owner-assigned rights outside the envelope.
      if (kind === "employee") {
        await tx.query(
          "DELETE FROM public.account_grants WHERE account_id=$1 AND NOT(permission_code=ANY($2::text[]))",
          [targetId, proposed],
        );
        for (const code of proposed.filter((c) => !target.grants.includes(c)))
          await tx.query(
            "INSERT INTO public.account_grants(account_id,account_profile,permission_code,prerequisite_key,created_by) VALUES($1,'employee',$2,$3,$4)",
            [
              targetId,
              code,
              permissionPrerequisites[code] ?? "",
              actor.accountId,
            ],
          );
      } else {
        await tx.query(
          "DELETE FROM public.employee_delegation_limits WHERE delegator_account_id=$1 AND NOT(permission_code=ANY($2::text[]))",
          [targetId, proposed],
        );
        for (const code of proposed.filter((c) => !target.grants.includes(c)))
          await tx.query(
            "INSERT INTO public.employee_delegation_limits(delegator_account_id,permission_code,created_by) VALUES($1,$2,$3)",
            [targetId, code, actor.accountId],
          );
      }
      const updated = await tx.query(
        "UPDATE public.accounts SET revision=revision+1,auth_epoch=auth_epoch+1 WHERE id=$1 AND revision=$2 RETURNING id",
        [targetId, target.revision],
      );
      if (updated.rows.length !== 1)
        throw new Error("DELEGATION_REVISION_WRITE_FAILED");
      await tx.query(
        "UPDATE public.sessions SET revoked_at=GREATEST(clock_timestamp(),created_at) WHERE account_id=$1 AND revoked_at IS NULL",
        [targetId],
      );
      await record(
        tx,
        actor,
        kind,
        targetId,
        target.revision,
        target.grants,
        proposed,
      );
      return "applied";
    });
  }
  return {
    loadCurrent: (actor: Actor, targetId: string) =>
      database.transaction(async (tx) => {
        const c = await context(tx, actor, "employee", targetId);
        return c?.target ? { ...c, target: c.target } : null;
      }),
    applyAtomic: (
      actor: Actor,
      input: {
        targetAccountId: string;
        expectedRevision: number;
        permissionCodes: readonly string[];
        confirmedDroppedCodes?: readonly string[];
      },
    ) =>
      apply(actor, "employee", input.targetAccountId, {
        expected_revision: input.expectedRevision,
        permission_codes: [...input.permissionCodes] as PermissionCode[],
        ...(input.confirmedDroppedCodes
          ? {
              confirmed_dropped_codes: [
                ...input.confirmedDroppedCodes,
              ] as PermissionCode[],
            }
          : {}),
      }),
    applyEnvelope: (actor: Actor, targetId: string, input: DelegationCommand) =>
      apply(actor, "envelope", targetId, input),
    async profile(actor: Actor, kind: DelegationKind, targetId: string) {
      return database.transaction(async (tx) => {
        const c = await context(tx, actor, kind, targetId);
        if (!c?.target) return null;
        return DelegationProfileSchema.parse({
          id: c.target.id,
          revision: c.target.revision,
          email: c.target.email,
          permission_codes: c.target.grants,
          editable_codes: isCurrentOwner(c.actor)
            ? effectivePermissionCodes(c.actor).filter((code) =>
                grantableCode("employee", code),
              )
            : c.envelope,
        });
      });
    },
    async list(actor: Actor, kind: DelegationKind, after?: string) {
      return database.transaction(async (tx) => {
        if (!(await context(tx, actor, kind))) return null;
        const result = await tx.query(
          "SELECT id,email_original AS email,lifecycle FROM public.accounts WHERE profile=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT 51",
          [targetRole(kind), after ?? null],
        );
        const items = result.rows.slice(0, 50);
        return DelegationListSchema.parse({
          items,
          next_after: result.rows.length > 50 ? items[49]?.id : null,
        });
      });
    },
    async history(
      actor: Actor,
      kind: DelegationKind,
      targetId: string,
      before?: number,
    ) {
      return database.transaction(async (tx) => {
        if (!(await context(tx, actor, kind, targetId))?.target) return null;
        const result = await tx.query<{
          id: string;
          actor_id: string;
          revision: string;
          occurred_at: Date;
          previous_codes: string[];
          next_codes: string[];
        }>(
          "SELECT id,actor_id,aggregate_revision::text AS revision,occurred_at,previous_codes,next_codes FROM public.delegation_events WHERE target_account_id=$1 AND kind=$2 AND ($3::bigint IS NULL OR aggregate_revision<$3) ORDER BY aggregate_revision DESC LIMIT 51",
          [targetId, kind, before ?? null],
        );
        const items = result.rows.slice(0, 50).map((r) => ({
          ...r,
          revision: Number(r.revision),
          occurred_at: r.occurred_at.toISOString(),
        }));
        return DelegationHistorySchema.parse({
          items,
          next_before: result.rows.length > 50 ? items[49]?.revision : null,
        });
      });
    },
  };
}
export async function assertDelegationStorageReady(database: DatabaseExecutor) {
  const result = await database.query<{ ready: boolean }>(`SELECT
 has_table_privilege(current_user,'public.delegation_events','SELECT') AND has_table_privilege(current_user,'public.delegation_events','INSERT')
 AND NOT has_table_privilege(current_user,'public.delegation_events','UPDATE,DELETE,TRUNCATE')
 AND has_table_privilege(current_user,'public.account_grants','SELECT') AND has_table_privilege(current_user,'public.account_grants','INSERT') AND has_table_privilege(current_user,'public.account_grants','DELETE')
 AND has_table_privilege(current_user,'public.employee_delegation_limits','SELECT') AND has_table_privilege(current_user,'public.employee_delegation_limits','INSERT') AND has_table_privilege(current_user,'public.employee_delegation_limits','DELETE') AS ready`);
  if (result.rows[0]?.ready !== true)
    throw new Error("DELEGATION_STORAGE_NOT_READY");
}
