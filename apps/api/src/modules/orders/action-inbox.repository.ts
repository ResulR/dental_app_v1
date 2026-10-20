import {
  ActionInboxQuerySchema,
  ActionInboxPageSchema,
} from "@dental-lab/contracts";
import type { createApplicationDatabase } from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
export function createActionInboxRepository(
  db: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async list(actor: { accountId: string; sessionId: string }, raw: unknown) {
      const parsed = ActionInboxQuerySchema.safeParse(raw);
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
        if (!identity || identity.profile === "clinic")
          return { kind: "denied" as const };
        const p = identity.permissions;
        const review =
            p.includes("orders.accept") ||
            p.includes("orders.reject") ||
            p.includes("orders.request_correction"),
          modify = p.includes("orders.edit_instructions"),
          cancel = p.includes("orders.cancel"),
          register = p.includes("clinics.manage");
        if (!review && !modify && !cancel && !register)
          return { kind: "denied" as const };
        // Current workflow state, never notification.read_at; no medical/version payload is selected.
        const rows = await tx.query(
          `WITH actions AS (
 SELECT o.id,CASE WHEN o.kind='retouch' THEN 'retouch' WHEN latest.previous_status='correction_requested' THEN 'correction_resubmitted' ELSE 'new_order' END AS kind,
 CASE WHEN o.kind='retouch' THEN 0 WHEN l.priority THEN 1 ELSE 2 END AS rank,o.id AS order_id,o.number::text,c.name AS clinic_name,COALESCE(latest.occurred_at,o.received_at) AS occurred_at,o.revision
 FROM public.orders o JOIN public.clinics c ON c.id=o.clinic_id JOIN public.order_logistics l ON l.order_id=o.id
 LEFT JOIN LATERAL (SELECT e.previous_status,e.occurred_at FROM public.order_status_events e WHERE e.order_id=o.id ORDER BY e.aggregate_revision DESC LIMIT 1) latest ON true
 WHERE $1::boolean AND o.status='pending'
 UNION ALL
 SELECT r.id,r.kind,CASE WHEN o.kind='retouch' THEN 0 WHEN l.priority THEN 1 ELSE 2 END,o.id,o.number::text,c.name,r.requested_at,r.revision
 FROM public.order_requests r JOIN public.orders o ON o.id=r.order_id AND o.clinic_id=r.clinic_id JOIN public.clinics c ON c.id=o.clinic_id JOIN public.order_logistics l ON l.order_id=o.id
 WHERE r.state='pending' AND o.status='accepted' AND ((r.kind='modification' AND $2::boolean) OR (r.kind='cancellation' AND $3::boolean))
 UNION ALL
 SELECT c.id,'registration',2,NULL::uuid,NULL::text,c.name,c.created_at,c.revision FROM public.clinics c WHERE $4::boolean AND c.review_state='pending'
 ) SELECT id,kind,rank,order_id,number,clinic_name,occurred_at,revision::text FROM actions
 WHERE ($5::integer IS NULL OR (rank,id,kind)>($5::integer,$6::uuid,$7::text)) ORDER BY rank,id,kind LIMIT 51`,
          [
            review,
            modify,
            cancel,
            register,
            parsed.data.after?.rank ?? null,
            parsed.data.after?.id ?? null,
            parsed.data.after?.kind ?? null,
          ],
        );
        const items = rows.rows.slice(0, 50).map((v) => ({
            ...v,
            revision: Number(v.revision),
            occurred_at:
              v.occurred_at instanceof Date
                ? v.occurred_at.toISOString()
                : v.occurred_at,
          })),
          last = rows.rows[49];
        return {
          kind: "page" as const,
          page: ActionInboxPageSchema.parse({
            permissions: p,
            items,
            next_after:
              rows.rows.length > 50 && last
                ? { rank: last.rank, id: last.id, kind: last.kind }
                : null,
          }),
        };
      });
    },
  };
}
