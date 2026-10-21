import { AuditLogQuerySchema, AuditLogPageSchema } from "@dental-lab/contracts";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
type Actor = { accountId: string; sessionId: string };
export function createAuditReadRepository(
  db: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async page(actor: Actor, raw: unknown) {
      const parsed = AuditLogQuerySchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return db.transaction(async (tx) => {
        await tx.query("SELECT id FROM public.accounts WHERE id=$1 FOR SHARE", [
          actor.accountId,
        ]);
        await tx.query("LOCK TABLE public.account_grants IN SHARE MODE");
        await tx.query(
          "SELECT id FROM public.sessions WHERE id=$1 AND account_id=$2 FOR SHARE",
          [actor.sessionId, actor.accountId],
        );
        const identity =
          await createCurrentPermissionsRepository(tx).current(actor);
        // current() requires the active, current owner slot; audit is intrinsic and not delegable.
        if (identity?.profile !== "owner") return { kind: "denied" as const };
        const input = parsed.data;
        const rows = await tx.query<{
          id: string;
          occurred_at: Date;
          aggregate_revision: string | null;
        }>(
          "SELECT id,occurred_at,actor_id,process_code,action,object_type,object_id,request_id,aggregate_revision::text,reason_code,changed_fields FROM public.audit_events WHERE ($1::text IS NULL OR action=$1) AND ($2::text IS NULL OR object_type=$2) AND ($3::timestamptz IS NULL OR (occurred_at,id)<($3::timestamptz,$4::uuid)) ORDER BY occurred_at DESC,id DESC LIMIT 51",
          [
            input.action ?? null,
            input.object_type ?? null,
            input.before?.occurred_at ?? null,
            input.before?.id ?? null,
          ],
        );
        const selected = rows.rows.slice(0, 50).map((row) => ({
          ...row,
          occurred_at:
            row.occurred_at instanceof Date
              ? row.occurred_at.toISOString()
              : row.occurred_at,
          aggregate_revision:
            row.aggregate_revision === null
              ? null
              : Number(row.aggregate_revision),
        }));
        const tail = selected.at(-1);
        return {
          kind: "result" as const,
          result: AuditLogPageSchema.parse({
            items: selected,
            next_before:
              rows.rows.length > 50 && tail
                ? { occurred_at: tail.occurred_at, id: tail.id }
                : null,
          }),
        };
      });
    },
  };
}
export async function assertAuditReadReady(db: DatabaseExecutor) {
  const r = await db.query(
    "SELECT has_table_privilege(current_user,'public.audit_events','SELECT') AND has_table_privilege(current_user,'public.audit_events','INSERT') AND NOT has_table_privilege(current_user,'public.audit_events','UPDATE') AND NOT has_table_privilege(current_user,'public.audit_events','DELETE') AND NOT has_table_privilege(current_user,'public.audit_events','TRUNCATE') AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid='public.audit_events'::regclass AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege(current_user,a.attrelid,a.attnum,'UPDATE')) AS ready",
  );
  if (r.rows[0]?.ready !== true)
    throw new Error("AUDIT_READ_STORAGE_NOT_READY");
}
