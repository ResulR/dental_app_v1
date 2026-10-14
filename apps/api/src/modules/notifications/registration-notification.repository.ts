import type { createApplicationDatabase } from "../../shared/database.js";

// Durable planning only. No provider, network send, timer or startup side effect.
export function createRegistrationNotificationRepository(
  database: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async prepare(eventId: string): Promise<"prepared" | "skipped"> {
      return database.transaction(async (tx) => {
        const result = await tx.query<{ state: string }>(
          `SELECT d.state FROM public.outbox_dispatches d
           JOIN public.outbox_events e ON e.id=d.event_id
           WHERE e.id=$1 AND e.type='clinic_registered'
             AND e.aggregate_type='clinic' AND e.aggregate_id=e.clinic_id
           FOR UPDATE OF d`,
          [eventId],
        );
        if (result.rows[0]?.state !== "pending") return "skipped";
        const owner = await tx.query(`SELECT a.id FROM public.owner_slot s
          JOIN public.accounts a ON a.id=s.account_id WHERE s.singleton=1
          AND a.profile='owner' AND a.lifecycle='active'
          AND NOT a.security_locked AND NOT a.credential_reset_required`);
        if (owner.rows.length !== 1)
          throw new Error("REGISTRATION_OWNER_RECIPIENT_UNAVAILABLE");
        // Owner plus explicitly selected, currently eligible administrators.
        // No employee/clinic, recipient email, patient data or message body is copied.
        await tx.query(
          `INSERT INTO public.notification_deliveries
          (event_id,target_account_id,channel,purpose)
          SELECT $1,a.id,'email','business' FROM public.accounts a
          WHERE a.lifecycle='active' AND NOT a.security_locked
            AND NOT a.credential_reset_required AND (
            (a.profile='owner' AND EXISTS(SELECT 1 FROM public.owner_slot s
              WHERE s.singleton=1 AND s.account_id=a.id))
            OR (a.profile='admin' AND EXISTS(SELECT 1 FROM public.email_category_recipients r
              WHERE r.category='clinic_registered' AND r.account_id=a.id)
              AND EXISTS(SELECT 1 FROM public.account_grants g
              WHERE g.account_id=a.id AND g.permission_code='clinics.manage')))
          ON CONFLICT(event_id,target_account_id,channel,purpose) DO NOTHING`,
          [eventId],
        );
        // Global dispatch is acknowledged only after all event consumers finish.
        return "prepared";
      });
    },
  };
}
