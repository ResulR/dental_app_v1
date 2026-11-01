import { randomUUID } from "node:crypto";
import type { createApplicationDatabase } from "../../shared/database.js";

/**
 * Dormant, bounded generator. A trusted internal caller may invoke a batch after
 * migration 0025; no route, scheduler or e-mail dispatch is registered here.
 * PostgreSQL order locks and the outbox uniqueness constraint serialize rivals.
 */
export function createDeadlineNoticeRepository(
  db: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async generateBatch() {
      return db.transaction(async (tx) => {
        // The civil date follows the existing Brussels display policy. The
        // database supplies the clock; no browser-provided date is trusted.
        const candidates = await tx.query(
          `SELECT o.id,o.clinic_id,o.revision::text AS revision,
             CASE WHEN COALESCE(l.planned_delivery_date,v.requested_delivery_date)
               < (statement_timestamp() AT TIME ZONE 'Europe/Brussels')::date
               THEN 'order_overdue' ELSE 'order_due_soon' END AS kind
           FROM public.orders o
           JOIN public.order_logistics l ON l.order_id=o.id AND l.clinic_id=o.clinic_id
           JOIN public.order_versions v ON v.id=o.current_version_id AND v.order_id=o.id
             AND v.clinic_id=o.clinic_id
           WHERE o.status NOT IN ('delivered','rejected','cancelled')
             AND COALESCE(l.planned_delivery_date,v.requested_delivery_date) IS NOT NULL
             AND COALESCE(l.planned_delivery_date,v.requested_delivery_date)
               <= (statement_timestamp() AT TIME ZONE 'Europe/Brussels')::date + 2
             AND NOT EXISTS (
               SELECT 1 FROM public.outbox_events e
               WHERE e.aggregate_type='order' AND e.aggregate_id=o.id
                 AND e.aggregate_revision=o.revision
                 AND e.type=CASE WHEN COALESCE(l.planned_delivery_date,v.requested_delivery_date)
                   < (statement_timestamp() AT TIME ZONE 'Europe/Brussels')::date
                   THEN 'order_overdue' ELSE 'order_due_soon' END)
           ORDER BY COALESCE(l.planned_delivery_date,v.requested_delivery_date),o.id
           LIMIT 100 FOR UPDATE OF o SKIP LOCKED`,
        );
        let created = 0;
        for (const row of candidates.rows) {
          // Recheck after the order lock: date and status writers acquire the
          // same order lock before changing either revision or logistics.
          const event = await tx.query(
            `INSERT INTO public.outbox_events
              (id,type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,process_code,correlation_id)
             VALUES ($1,$2,'order',$3,$4,$5,'delivery_deadline_monitor',$6)
             ON CONFLICT (aggregate_type,aggregate_id,aggregate_revision,type) DO NOTHING
             RETURNING id`,
            [
              randomUUID(),
              row.kind,
              row.id,
              row.revision,
              row.clinic_id,
              randomUUID(),
            ],
          );
          if (event.rows.length === 0) continue;
          // The owner is the only recipient until a separately approved
          // collaborator policy exists. Hold the account lock through commit
          // so concurrent suspension cannot create a notice for a stale owner.
          const owner = await tx.query(
            `SELECT a.id FROM public.owner_slot s JOIN public.accounts a ON a.id=s.account_id
             WHERE s.singleton=1 AND a.profile='owner' AND a.lifecycle='active'
               AND NOT a.security_locked AND NOT a.credential_reset_required
             FOR SHARE OF a`,
          );
          if (owner.rows.length !== 1)
            throw new Error("DEADLINE_NOTICE_OWNER_UNAVAILABLE");
          const notice = await tx.query(
            `INSERT INTO public.internal_notifications(event_id,target_account_id)
             VALUES ($1,$2) ON CONFLICT (event_id,target_account_id) DO NOTHING RETURNING id`,
            [event.rows[0]!.id, owner.rows[0]!.id],
          );
          if (notice.rows.length !== 1)
            throw new Error("DEADLINE_NOTICE_OWNER_UNAVAILABLE");
          created++;
        }
        return { created, inspected: candidates.rows.length };
      });
    },
  };
}
