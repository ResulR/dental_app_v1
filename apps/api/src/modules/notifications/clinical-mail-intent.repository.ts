import type { createApplicationDatabase } from "../../shared/database.js";
import { businessMailIntent } from "./business-event-policy.js";

// Durable planning only. Never contacts a provider or acknowledges dispatch.
export function createClinicalMailIntentRepository(
  database: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async prepare(eventId: string): Promise<"prepared" | "skipped"> {
      return database.transaction(async (tx) => {
        const event = await tx.query<{ type: string; state: string }>(
          `SELECT e.type,d.state FROM public.outbox_dispatches d
           JOIN public.outbox_events e ON e.id=d.event_id
           WHERE e.id=$1 AND e.clinic_id IS NOT NULL AND e.aggregate_type='order'
           FOR UPDATE OF d`,
          [eventId],
        );
        if (
          event.rows[0]?.state !== "pending" ||
          businessMailIntent(event.rows[0]!.type)?.audience !== "clinic"
        )
          return "skipped";
        // Resolve the current clinic account. No email address, body or patient data
        // enters the delivery row. A retry may find an existing unique intent.
        const delivery = await tx.query(
          `INSERT INTO public.notification_deliveries
           (event_id,target_account_id,channel,purpose)
           SELECT $1,a.id,'email','business' FROM public.outbox_events e
           JOIN public.orders o ON o.id=e.aggregate_id AND o.clinic_id=e.clinic_id
           JOIN public.clinics c ON c.id=o.clinic_id
           JOIN public.accounts a ON a.id=c.account_id
           WHERE e.id=$1 AND c.review_state='approved' AND NOT c.suspended
             AND a.profile='clinic' AND a.lifecycle='active'
             AND NOT a.security_locked AND NOT a.credential_reset_required
           ON CONFLICT(event_id,target_account_id,channel,purpose) DO NOTHING
           RETURNING id`,
          [eventId],
        );
        return delivery.rows.length === 1 ? "prepared" : "skipped";
      });
    },
  };
}
