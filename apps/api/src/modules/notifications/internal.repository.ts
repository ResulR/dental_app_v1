import {
  InternalNoticePageSchema,
  InternalNoticeQuerySchema,
  InternalNoticeReadSchema,
  InternalNoticeReadResultSchema,
} from "@dental-lab/contracts";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";

type Actor = { accountId: string; sessionId: string };
export async function assertInternalNoticeReady(db: DatabaseExecutor) {
  const result = await db.query(
    "SELECT has_table_privilege(current_user,'public.internal_notifications','SELECT') AND has_table_privilege(current_user,'public.internal_notifications','INSERT') AND has_column_privilege(current_user,'public.internal_notifications','read_at','UPDATE') AND has_table_privilege(current_user,'public.outbox_events','SELECT') AS ready",
  );
  if (result.rows[0]?.ready !== true)
    throw new Error("INTERNAL_NOTICES_UNAVAILABLE");
}
async function viewer(tx: DatabaseExecutor, actor: Actor) {
  await tx.query("SELECT id FROM public.accounts WHERE id=$1 FOR SHARE", [
    actor.accountId,
  ]);
  // owner_slot is SELECT-only for the app role and has no runtime writer.
  // The actor account lock serializes suspension; the grant table lock
  // serializes permission revocation. current() reads owner_slot afterward.
  await tx.query("LOCK TABLE public.account_grants IN SHARE MODE");
  await tx.query(
    "SELECT id FROM public.sessions WHERE id=$1 AND account_id=$2 FOR SHARE",
    [actor.sessionId, actor.accountId],
  );
  await tx.query(
    "SELECT id FROM public.clinics WHERE account_id=$1 FOR SHARE",
    [actor.accountId],
  );
  const current = await createCurrentPermissionsRepository(tx).current(actor);
  if (!current) return null;
  if (current.profile === "clinic") {
    const clinic = await tx.query(
      "SELECT id FROM public.clinics WHERE account_id=$1 AND review_state='approved' AND NOT suspended",
      [actor.accountId],
    );
    if (clinic.rows.length !== 1) return null;
  }
  return [
    actor.accountId,
    current.profile === "owner",
    current.profile !== "clinic",
    current.permissions.includes("messaging.general.read"),
    current.permissions.includes("messaging.order.read"),
  ] as const;
}
const joins = `JOIN public.outbox_events e ON e.id=n.event_id
  JOIN public.clinics c ON c.id=e.clinic_id
  LEFT JOIN public.orders o ON o.id=e.aggregate_id AND o.clinic_id=c.id AND e.type IN ('order_submitted','correction_resubmitted','cancellation_requested','modification_requested','retouch_requested')
  LEFT JOIN public.messages m ON m.id=e.aggregate_id AND m.clinic_id=c.id AND e.type='message_created'
  LEFT JOIN public.conversations v ON v.id=m.conversation_id AND v.clinic_id=c.id
  LEFT JOIN public.orders mo ON mo.id=v.order_id AND mo.clinic_id=c.id AND v.kind='order'`;
const visible = `(
  ($2::boolean AND ((e.type='clinic_registered' AND e.aggregate_type='clinic' AND e.aggregate_id=c.id)
    OR (e.type IN ('order_submitted','correction_resubmitted','cancellation_requested','modification_requested','retouch_requested') AND e.aggregate_type='order' AND o.id IS NOT NULL)))
  OR (e.type='message_created' AND e.aggregate_type='message' AND m.id IS NOT NULL
    AND v.id IS NOT NULL AND m.sender_id<>$1 AND
    ((v.kind='general' AND v.order_id IS NULL) OR (v.kind='order' AND mo.id IS NOT NULL))
    AND (($3::boolean AND m.sender_side='clinic' AND
      ((v.kind='general' AND $4::boolean) OR (v.kind='order' AND $5::boolean)))
      OR (NOT $3::boolean AND m.sender_side='laboratory' AND c.account_id=$1
        AND c.review_state='approved' AND NOT c.suspended))))
)`;
export function createInternalNoticeRepository(
  db: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async list(actor: Actor, raw: unknown) {
      const parsed = InternalNoticeQuerySchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return db.transaction(async (tx) => {
        const scope = await viewer(tx, actor);
        if (!scope) return { kind: "denied" as const };
        const counts = await tx.query(
          `SELECT count(*)::text AS unread FROM public.internal_notifications n
           ${joins} WHERE n.target_account_id=$1 AND n.read_at IS NULL AND ${visible}`,
          [...scope],
        );
        const rows = await tx.query(
          `SELECT n.id,e.type AS kind,e.clinic_id,COALESCE(o.id,mo.id) AS order_id,
           v.id AS conversation_id,c.name AS clinic_name,c.revision::text AS clinic_revision,n.created_at,n.read_at
           FROM public.internal_notifications n ${joins}
           WHERE n.target_account_id=$1 AND ${visible}
             AND ($6::timestamptz IS NULL OR (n.created_at,n.id)<($6::timestamptz,$7::uuid))
           ORDER BY n.created_at DESC,n.id DESC LIMIT 51`,
          [
            ...scope,
            parsed.data.before_at ?? null,
            parsed.data.before_id ?? null,
          ],
        );
        const items = rows.rows.slice(0, 50).map((row) => ({
          id: row.id,
          kind: row.kind,
          clinic_id: row.clinic_id,
          order_id: row.order_id,
          conversation_id: row.conversation_id,
          clinic_name: row.clinic_name,
          clinic_revision: Number(row.clinic_revision),
          created_at:
            row.created_at instanceof Date
              ? row.created_at.toISOString()
              : row.created_at,
          read_at:
            row.read_at instanceof Date
              ? row.read_at.toISOString()
              : row.read_at,
        }));
        const last = rows.rows.length > 50 ? items[49]! : null;
        return {
          kind: "result" as const,
          result: InternalNoticePageSchema.parse({
            unread_count: Number(counts.rows[0]?.unread),
            items,
            next_before_at: last?.created_at ?? null,
            next_before_id: last?.id ?? null,
          }),
        };
      });
    },
    async markRead(actor: Actor, raw: unknown) {
      const parsed = InternalNoticeReadSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return db.transaction(async (tx) => {
        const scope = await viewer(tx, actor);
        if (!scope) return { kind: "denied" as const };
        const rows = await tx.query(
          `SELECT n.read_at FROM public.internal_notifications n ${joins}
           WHERE n.target_account_id=$1 AND ${visible} AND n.id=$6
           FOR UPDATE OF n`,
          [...scope, parsed.data.id],
        );
        if (rows.rows.length !== 1) return { kind: "denied" as const };
        const readAt =
          rows.rows[0]!.read_at === null
            ? (
                await tx.query(
                  "UPDATE public.internal_notifications SET read_at=statement_timestamp() WHERE id=$1 AND target_account_id=$2 AND read_at IS NULL RETURNING read_at",
                  [parsed.data.id, actor.accountId],
                )
              ).rows[0]?.read_at
            : rows.rows[0]!.read_at;
        return {
          kind: "result" as const,
          result: InternalNoticeReadResultSchema.parse({
            id: parsed.data.id,
            read_at: readAt instanceof Date ? readAt.toISOString() : readAt,
          }),
        };
      });
    },
  };
}
