import { randomUUID } from "node:crypto";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { businessMailIntent } from "./business-event-policy.js";
import { nextDeliveryRetry, type DeliveryOutcome } from "./delivery-retry.js";

type Database = Pick<
  ReturnType<typeof createApplicationDatabase>,
  "transaction"
>;
type Lease = { id: string; lease_id: string; attempt_count: number };
type Candidate = Lease & {
  event_id: string;
  target_account_id: string;
  type: string;
};
export type DeliveryLease = Readonly<Lease>;
export type DeliveryDecision = "eligible" | "cancelled" | "lost";

// Deliberately not registered in the HTTP runtime or a timer. SQL dates come from
// the database clock; the caller cannot forge expiry or seize another lease.
export function createDormantDeliveryRepository(database: Database) {
  async function recoverExpired(): Promise<boolean> {
    return database.transaction(async (tx) => {
      const expired = await tx.query<Lease>(
        `SELECT id,lease_id,attempt_count FROM public.notification_deliveries
         WHERE channel='email' AND purpose='business' AND state='pending'
           AND lease_id IS NOT NULL AND lease_until<=clock_timestamp()
         ORDER BY next_attempt_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`,
      );
      const row = expired.rows[0];
      if (!row) return false;
      // A crashed process might have reached the provider. Fail closed, even if
      // it actually crashed before the call. Never reuse an expired lease.
      await tx.query(
        `INSERT INTO public.notification_attempts
         (delivery_id,attempt_number,result,error_code)
         VALUES($1,$2,'ambiguous','LEASE_EXPIRED')`,
        [row.id, row.attempt_count],
      );
      await tx.query(
        `UPDATE public.notification_deliveries SET state='failed',
         lease_id=NULL,lease_until=NULL
         WHERE id=$1 AND lease_id=$2 AND state='pending'`,
        [row.id, row.lease_id],
      );
      return true;
    });
  }

  async function claim(): Promise<DeliveryLease | null> {
    return database.transaction(async (tx) => {
      const candidate = await tx.query<Lease>(
        `SELECT id,lease_id,attempt_count FROM public.notification_deliveries
         WHERE channel='email' AND purpose='business' AND state='pending'
           AND lease_id IS NULL AND next_attempt_at<=clock_timestamp()
         ORDER BY next_attempt_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`,
      );
      const row = candidate.rows[0];
      if (!row) return null;
      const leaseId = randomUUID();
      const claimed = await tx.query<Lease>(
        `UPDATE public.notification_deliveries SET lease_id=$2,
         lease_until=clock_timestamp()+interval '60 seconds',
         attempt_count=attempt_count+1
         WHERE id=$1 AND state='pending' AND lease_id IS NULL
         RETURNING id,lease_id,attempt_count`,
        [row.id, leaseId],
      );
      return claimed.rows[0] ?? null;
    });
  }

  async function preflight(lease: DeliveryLease): Promise<DeliveryDecision> {
    return database.transaction(async (tx) => {
      const selected = await tx.query<Candidate>(
        `SELECT d.id,d.lease_id,d.attempt_count,d.event_id,
           d.target_account_id,e.type
         FROM public.notification_deliveries d
         JOIN public.outbox_events e ON e.id=d.event_id
         WHERE d.id=$1 AND d.lease_id=$2 AND d.attempt_count=$3
           AND d.state='pending' AND d.lease_until>clock_timestamp()
           AND d.channel='email' AND d.purpose='business'
         FOR UPDATE OF d`,
        [lease.id, lease.lease_id, lease.attempt_count],
      );
      const row = selected.rows[0];
      if (!row) return "lost";
      const policy = businessMailIntent(row.type);
      let eligible = false;
      if (policy) {
        // Lock order, recipient and clinic while testing current state. The
        // configuration/grants are read now but may change after commit.
        const checked = await tx.query(
          `SELECT o.id FROM public.outbox_events e
           JOIN public.orders o ON o.id=e.aggregate_id
             AND o.clinic_id=e.clinic_id AND o.revision=e.aggregate_revision
             AND (CASE e.type
               WHEN 'order_submitted' THEN o.status='pending'
               WHEN 'order_accepted' THEN o.status='accepted'
               WHEN 'correction_requested' THEN o.status='correction_requested'
               WHEN 'order_rejected' THEN o.status='rejected'
               WHEN 'order_completed' THEN o.status='completed'
               WHEN 'order_cancelled' THEN o.status='cancelled'
               ELSE true END)
           JOIN public.clinics c ON c.id=o.clinic_id
           JOIN public.accounts sender ON sender.id=c.account_id
           JOIN public.accounts a ON a.id=$2
           WHERE e.id=$1 AND e.aggregate_type='order'
             AND c.review_state='approved' AND NOT c.suspended
             AND sender.lifecycle='active' AND NOT sender.security_locked
             AND NOT sender.credential_reset_required
             AND a.lifecycle='active' AND NOT a.security_locked
             AND NOT a.credential_reset_required
             AND (
               ($3='clinic' AND a.profile='clinic' AND a.id=c.account_id)
               OR ($3='laboratory' AND e.actor_id=c.account_id AND (
                 (a.profile='owner' AND EXISTS
                   (SELECT 1 FROM public.owner_slot s WHERE s.singleton=1 AND s.account_id=a.id))
                 OR (a.profile='admin' AND EXISTS
                   (SELECT 1 FROM public.email_category_recipients r
                    WHERE r.category=$4 AND r.account_id=a.id)
                   AND EXISTS (SELECT 1 FROM public.account_grants g
                    WHERE g.account_id=a.id AND g.permission_code='orders.read_details')
                   AND EXISTS (SELECT 1 FROM public.account_grants g
                    WHERE g.account_id=a.id AND g.permission_code='orders.read_logistics'))
               ))
             )
           FOR SHARE OF o,c,sender,a`,
          [
            row.event_id,
            row.target_account_id,
            policy.audience,
            policy.audience === "laboratory" ? policy.category : null,
          ],
        );
        eligible = checked.rows.length === 1;
      }
      if (eligible) return "eligible";
      await finish(tx, lease, "cancelled", "RECIPIENT_OR_EVENT_OBSOLETE");
      return "cancelled";
    });
  }

  async function settle(
    lease: DeliveryLease,
    outcome: DeliveryOutcome | "provider_accepted",
    providerId?: string,
  ): Promise<boolean> {
    if (
      outcome === "provider_accepted" &&
      (!providerId ||
        providerId.length > 128 ||
        !/^[A-Za-z0-9._:-]+$/.test(providerId))
    )
      throw new Error("DELIVERY_PROVIDER_ID_INVALID");
    if (outcome !== "provider_accepted" && providerId !== undefined)
      throw new Error("DELIVERY_PROVIDER_ID_INVALID");
    return database.transaction(async (tx) => {
      const owned = await tx.query<Lease>(
        `SELECT id,lease_id,attempt_count FROM public.notification_deliveries
         WHERE id=$1 AND lease_id=$2 AND attempt_count=$3
           AND state='pending' AND lease_until>clock_timestamp()
         FOR UPDATE`,
        [lease.id, lease.lease_id, lease.attempt_count],
      );
      if (!owned.rows[0]) return false;
      await tx.query(
        `INSERT INTO public.notification_attempts
         (delivery_id,attempt_number,result,error_code)
         VALUES($1,$2,$3,$4)`,
        [
          lease.id,
          lease.attempt_count,
          outcome,
          outcome === "provider_accepted" ? null : outcome.toUpperCase(),
        ],
      );
      if (outcome === "provider_accepted") {
        await tx.query(
          `UPDATE public.notification_deliveries SET state='provider_accepted',
           provider_id=$2,lease_id=NULL,lease_until=NULL WHERE id=$1`,
          [lease.id, providerId],
        );
      } else {
        const retry = nextDeliveryRetry(
          outcome,
          lease.attempt_count,
          new Date(0),
        );
        const delaySeconds = retry.nextAttemptAt
          ? retry.nextAttemptAt.getTime() / 1000
          : 0;
        await tx.query(
          `UPDATE public.notification_deliveries SET state=$2,
           next_attempt_at=clock_timestamp()+($3::integer * interval '1 second'),
           lease_id=NULL,lease_until=NULL WHERE id=$1`,
          [lease.id, retry.state, delaySeconds],
        );
      }
      return true;
    });
  }

  return { recoverExpired, claim, preflight, settle };
}

async function finish(
  tx: DatabaseExecutor,
  lease: DeliveryLease,
  state: "cancelled",
  cancellationCode: string,
) {
  // A skipped intent has no provider attempt. The number is still consumed,
  // so a crash after claiming cannot silently produce another send.
  await tx.query(
    `UPDATE public.notification_deliveries SET state=$2,cancellation_code=$3,
     lease_id=NULL,lease_until=NULL WHERE id=$1 AND lease_id=$4`,
    [lease.id, state, cancellationCode, lease.lease_id],
  );
}
