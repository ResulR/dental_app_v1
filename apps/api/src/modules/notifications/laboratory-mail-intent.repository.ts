import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { businessMailIntent } from "./business-event-policy.js";

// Prepared only: five order categories. Registration retains its dedicated adapter.
// No address, content, provider request or dispatch acknowledgement is produced.
export async function appendLaboratoryOrderMailIntent(
  tx: DatabaseExecutor,
  eventId: string,
): Promise<"prepared" | "skipped"> {
  const event = await tx.query<{ type: string; state: string }>(
    `SELECT e.type,d.state FROM public.outbox_dispatches d
     JOIN public.outbox_events e ON e.id=d.event_id
     WHERE e.id=$1 AND e.aggregate_type='order' AND e.clinic_id IS NOT NULL
     FOR UPDATE OF d`,
    [eventId],
  );
  const policy = event.rows[0] && businessMailIntent(event.rows[0].type);
  if (
    event.rows[0]?.state !== "pending" ||
    policy?.audience !== "laboratory" ||
    policy.category === "clinic_registered"
  )
    return "skipped";
  const category = policy.category;
  // A delayed event whose order has moved to another revision is obsolete.
  const current = await tx.query(
    `SELECT o.id FROM public.outbox_events e
     JOIN public.orders o ON o.id=e.aggregate_id AND o.clinic_id=e.clinic_id
       AND o.revision=e.aggregate_revision
     JOIN public.clinics sender ON sender.id=e.clinic_id AND sender.account_id=e.actor_id
     WHERE e.id=$1 FOR SHARE OF o,sender`,
    [eventId],
  );
  if (current.rows.length === 0) return "skipped";
  // No silent loss of an important event if the owner is unavailable.
  const owner = await tx.query(
    `SELECT a.id FROM public.owner_slot s
     JOIN public.accounts a ON a.id=s.account_id
     WHERE s.singleton=1 AND a.profile='owner' AND a.lifecycle='active'
       AND NOT a.security_locked AND NOT a.credential_reset_required
     FOR SHARE OF a`,
  );
  if (owner.rows.length !== 1)
    throw new Error("LABORATORY_MAIL_OWNER_UNAVAILABLE");
  // Lock selected accounts; grants/configuration have no UPDATE privilege and
  // cannot be row-locked by this role. Restrict insertion to the selected IDs
  // and recheck SQL predicates, but a sender must recheck after commit.
  const admins = await tx.query<{ id: string }>(
    `SELECT a.id FROM public.email_category_recipients r
     JOIN public.accounts a ON a.id=r.account_id AND a.profile='admin'
     JOIN public.account_grants detail ON detail.account_id=a.id
       AND detail.permission_code='orders.read_details'
     JOIN public.account_grants logistics ON logistics.account_id=a.id
       AND logistics.permission_code='orders.read_logistics'
     WHERE r.category=$1 AND a.lifecycle='active'
       AND NOT a.security_locked AND NOT a.credential_reset_required
     FOR SHARE OF a`,
    [category],
  );
  const inserted = await tx.query(
    `INSERT INTO public.notification_deliveries
     (event_id,target_account_id,channel,purpose)
     SELECT $1,a.id,'email','business' FROM public.outbox_events e
     JOIN public.orders o ON o.id=e.aggregate_id AND o.clinic_id=e.clinic_id
       AND o.revision=e.aggregate_revision
     JOIN public.clinics sender ON sender.id=e.clinic_id AND sender.account_id=e.actor_id
     JOIN public.accounts a ON a.lifecycle='active'
       AND NOT a.security_locked AND NOT a.credential_reset_required
     WHERE e.id=$1 AND a.id=ANY($3::uuid[]) AND (
       (a.profile='owner' AND EXISTS(SELECT 1 FROM public.owner_slot s
         WHERE s.singleton=1 AND s.account_id=a.id))
       OR (a.profile='admin' AND EXISTS(
         SELECT 1 FROM public.email_category_recipients r
         WHERE r.category=$2 AND r.account_id=a.id)
         AND EXISTS(SELECT 1 FROM public.account_grants g
           WHERE g.account_id=a.id AND g.permission_code='orders.read_details')
         AND EXISTS(SELECT 1 FROM public.account_grants g
           WHERE g.account_id=a.id AND g.permission_code='orders.read_logistics'))
     )
     ON CONFLICT(event_id,target_account_id,channel,purpose) DO NOTHING
     RETURNING id`,
    [eventId, category, [owner.rows[0]!.id, ...admins.rows.map((a) => a.id)]],
  );
  return inserted.rows.length > 0 ? "prepared" : "skipped";
}

export function createLaboratoryOrderMailIntentRepository(
  database: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    prepare(eventId: string) {
      return database.transaction((tx) =>
        appendLaboratoryOrderMailIntent(tx, eventId),
      );
    },
  };
}
