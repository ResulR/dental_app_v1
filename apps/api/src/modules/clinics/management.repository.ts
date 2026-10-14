import { randomUUID } from "node:crypto";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { currentRequestCorrelation } from "../../shared/request-correlation.js";
import {
  ClinicProfileSchema,
  ClinicReviewQueueSchema,
} from "@dental-lab/contracts";
import type { ClinicDecision } from "./review.service.js";
type Database = Pick<
  ReturnType<typeof createApplicationDatabase>,
  "transaction"
>;
type Identity = {
  accountId: string;
  sessionId: string;
  profile: "owner" | "admin" | "employee" | "clinic";
};
type Access = {
  profile: Identity["profile"];
  owner: boolean;
  managed: boolean;
};
export function createClinicManagementRepository(
  database: Database,
  identity: Identity,
) {
  async function access(tx: DatabaseExecutor): Promise<Access | undefined> {
    // Account then session: same order as session revocation. No client grants.
    await tx.query("SELECT id FROM public.accounts WHERE id=$1 FOR SHARE", [
      identity.accountId,
    ]);
    const sessions = await tx.query(
      `SELECT s.id FROM public.sessions s
   JOIN public.accounts a ON a.id=s.account_id
   JOIN public.session_limits l ON l.session_id=s.id
   WHERE s.id=$1 AND s.account_id=$2 AND s.revoked_at IS NULL
   AND s.expires_at>clock_timestamp() AND l.absolute_expires_at>clock_timestamp()
   AND s.auth_epoch=a.auth_epoch AND a.lifecycle='active'
   AND NOT a.security_locked AND NOT a.credential_reset_required
   FOR SHARE OF s`,
      [identity.sessionId, identity.accountId],
    );
    if (sessions.rows.length !== 1) return;
    // DELETE privilege from 0010 permits SHARE table lock. Blocks grant changes
    // through commit; timeout is failure, never a fallback to unlocked access.
    await tx.query("LOCK TABLE public.account_grants IN SHARE MODE");
    const result = await tx.query<Access>(
      `SELECT a.profile,
   EXISTS(SELECT 1 FROM public.owner_slot o WHERE o.account_id=a.id) owner,
   EXISTS(SELECT 1 FROM public.account_grants g WHERE g.account_id=a.id AND g.permission_code='clinics.manage') managed
   FROM public.accounts a WHERE a.id=$1`,
      [identity.accountId],
    );
    const row = result.rows[0];
    return row?.profile === identity.profile ? row : undefined;
  }
  const manager = (a: Access | undefined) =>
    !!a &&
    ((a.profile === "owner" && a.owner) ||
      (["admin", "employee"].includes(a.profile) && a.managed));
  async function emit(
    tx: DatabaseExecutor,
    clinicId: string,
    revision: number,
    action: string,
  ) {
    const event = randomUUID(),
      correlation = currentRequestCorrelation();
    await tx.query(
      "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision) VALUES($1,$2,'clinic',$3,$4,$5)",
      [identity.accountId, action, clinicId, correlation, revision],
    );
    await tx.query(
      "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,actor_id,correlation_id) VALUES($1,'account_changed','clinic',$2,$3,$2,$4,$5)",
      [event, clinicId, revision, identity.accountId, correlation],
    );
    await tx.query(
      "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
      [event],
    );
  }
  return {
    async authorize(): Promise<boolean> {
      return database.transaction(async (tx) => manager(await access(tx)));
    },
    async decideAtomic(
      input: ClinicDecision & { actorAccountId: string },
    ): Promise<"applied" | "stale" | "not_pending" | "denied"> {
      if (input.actorAccountId !== identity.accountId) return "denied";
      return database.transaction(async (tx) => {
        if (!manager(await access(tx))) return "denied";
        const result = await tx.query<{
          revision: string;
          review_state: string;
        }>(
          "SELECT revision::text,review_state FROM public.clinics WHERE id=$1 FOR UPDATE",
          [input.clinicId],
        );
        const current = result.rows[0];
        if (!current) return "denied";
        if (current.revision !== String(input.expectedRevision)) return "stale";
        if (current.review_state !== "pending") return "not_pending";
        const next = input.expectedRevision + 1;
        if (!Number.isSafeInteger(next))
          throw new Error("CLINIC_REVISION_EXHAUSTED");
        await tx.query(
          "UPDATE public.clinics SET review_state=$2,revision=revision+1 WHERE id=$1",
          [input.clinicId, input.decision],
        );
        await tx.query(
          "INSERT INTO public.clinic_review_events(clinic_id,actor_id,previous_state,next_state,reason,aggregate_revision) VALUES($1,$2,'pending',$3,$4,$5)",
          [
            input.clinicId,
            identity.accountId,
            input.decision,
            input.reason ?? null,
            next,
          ],
        );
        await emit(tx, input.clinicId, next, "CLINIC_REVIEWED");
        return "applied";
      });
    },
    async pending(after?: string) {
      return database.transaction(async (tx) => {
        if (!manager(await access(tx))) return null;
        const result = await tx.query<{
          id: string;
          name: string;
          revision: string;
        }>(
          "SELECT id,name,revision::text FROM public.clinics WHERE review_state='pending' AND ($1::uuid IS NULL OR id>$1) ORDER BY id LIMIT 51",
          [after ?? null],
        );
        const rows = result.rows.slice(0, 50);
        return ClinicReviewQueueSchema.parse({
          items: rows.map((row) => ({
            ...row,
            revision: Number(row.revision),
          })),
          next_after: result.rows.length > 50 ? rows[49]?.id : null,
        });
      });
    },
    async readProfile(clinicId?: string) {
      return database.transaction(async (tx) => {
        const permission = await access(tx);
        if (!permission) return null;
        if (permission.profile !== "clinic" && !manager(permission))
          return null;
        const result = await tx.query<{
          id: string;
          revision: string;
          name: string;
          dentist_first_name: string;
          dentist_last_name: string;
          phone: string;
          address: string;
          suspended: boolean;
          account_id: string;
        }>(
          `SELECT id,revision::text,name,dentist_first_name,dentist_last_name,phone,address,suspended,account_id FROM public.clinics
     WHERE ($1::uuid IS NOT NULL AND id=$1) OR ($1::uuid IS NULL AND account_id=$2) FOR SHARE`,
          [clinicId ?? null, identity.accountId],
        );
        const row = result.rows[0];
        if (
          !row ||
          (permission.profile === "clinic" &&
            (row.account_id !== identity.accountId || row.suspended))
        )
          return null;
        return ClinicProfileSchema.parse({
          id: row.id,
          revision: Number(row.revision),
          name: row.name,
          dentist_first_name: row.dentist_first_name,
          dentist_last_name: row.dentist_last_name,
          phone: row.phone,
          address: row.address,
        });
      });
    },
  };
}

export async function assertClinicManagementStorageReady(
  database: DatabaseExecutor,
): Promise<void> {
  const result = await database.query<{
    ready: boolean;
  }>(`/* clinic_management_readiness */ SELECT
 has_table_privilege(current_user,'public.clinic_review_events','INSERT')
 AND has_table_privilege(current_user,'public.clinic_review_events','SELECT')
 AND has_column_privilege(current_user,'public.clinics','review_state','UPDATE')
 AND has_column_privilege(current_user,'public.clinics','revision','UPDATE')
 AND has_column_privilege(current_user,'public.accounts','revision','UPDATE')
 AND has_column_privilege(current_user,'public.sessions','revoked_at','UPDATE')
 AND has_table_privilege(current_user,'public.account_grants','DELETE')
 AND has_table_privilege(current_user,'public.audit_events','INSERT')
 AND has_table_privilege(current_user,'public.outbox_events','INSERT')
 AND has_table_privilege(current_user,'public.outbox_dispatches','INSERT') AS ready`);
  if (result.rows.length !== 1 || result.rows[0]?.ready !== true)
    throw new Error("CLINIC_MANAGEMENT_STORAGE_NOT_READY");
}
