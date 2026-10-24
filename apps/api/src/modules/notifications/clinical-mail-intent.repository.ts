import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { businessMailIntent } from "./business-event-policy.js";

// May be called within the producer's transaction, after event and dispatch inserts.
// It never acknowledges a dispatch or contacts a provider.
export async function appendClinicalMailIntent(
  tx: DatabaseExecutor,
  eventId: string,
): Promise<"prepared" | "skipped"> {
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
  // Serialize with order revisions. A decision that commits after this check
  // must wait for this transaction; a decision that committed first is stale.
  const order = await tx.query(
    `SELECT o.id FROM public.outbox_events e
     JOIN public.orders o ON o.id=e.aggregate_id AND o.clinic_id=e.clinic_id
     WHERE e.id=$1 AND o.revision=e.aggregate_revision FOR SHARE OF o`,
    [eventId],
  );
  if (order.rows.length !== 1) return "skipped";
  // Keep a concurrent clinic suspension/account revocation behind preparation.
  // The eventual sender must check again before using any address.
  const recipient = await tx.query(
    `SELECT a.id FROM public.outbox_events e
     JOIN public.clinics c ON c.id=e.clinic_id
     JOIN public.accounts a ON a.id=c.account_id
     WHERE e.id=$1 AND c.review_state='approved' AND NOT c.suspended
       AND a.profile='clinic' AND a.lifecycle='active'
       AND NOT a.security_locked AND NOT a.credential_reset_required
     FOR SHARE OF c,a`,
    [eventId],
  );
  if (recipient.rows.length !== 1) return "skipped";
  // No address, body, patient or file metadata is copied into the delivery row.
  const delivery = await tx.query(
    `INSERT INTO public.notification_deliveries
     (event_id,target_account_id,channel,purpose)
     SELECT $1,a.id,'email','business' FROM public.outbox_events e
     JOIN public.orders o ON o.id=e.aggregate_id AND o.clinic_id=e.clinic_id
       AND o.revision=e.aggregate_revision
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
}

// Separate, restartable preparation for a committed event. The unique key
// deduplicates concurrent attempts; a future sender must recheck current rights.
export function createClinicalMailIntentRepository(
  database: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    prepare(eventId: string) {
      return database.transaction((tx) =>
        appendClinicalMailIntent(tx, eventId),
      );
    },
  };
}
