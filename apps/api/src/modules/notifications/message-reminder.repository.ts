import { randomUUID } from "node:crypto";
import type { createApplicationDatabase } from "../../shared/database.js";

// Dormant generator: no route, timer or delivery worker imports this repository.
// A real sender must recheck the cycle, unread messages and current recipients.
export function createMessageReminderRepository(
  db: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async generateBatch() {
      return db.transaction(async (tx) => {
        // Message insertion locks the conversation exclusively; markRead holds a
        // share lock. The cycle and its outbox intent therefore reflect one
        // serialization point, even with concurrent readers and generators.
        const conversations = await tx.query<{
          id: string;
          clinic_id: string;
          kind: string;
        }>(
          `SELECT c.id,c.clinic_id,c.kind FROM public.conversations c
           WHERE EXISTS (SELECT 1 FROM public.messages m
             JOIN public.conversation_reads r ON r.conversation_id=c.id
               AND r.side<>m.sender_side AND m.sequence_number>r.last_read_seq
             WHERE m.conversation_id=c.id
               AND m.created_at<=statement_timestamp()-interval '30 minutes')
           ORDER BY c.id LIMIT 100 FOR UPDATE OF c SKIP LOCKED`,
        );
        let created = 0;
        for (const conversation of conversations.rows) {
          for (const side of ["clinic", "laboratory"] as const) {
            await tx.query(
              `INSERT INTO public.message_reminder_cycles(conversation_id,side)
               VALUES($1,$2) ON CONFLICT(conversation_id,side) DO NOTHING`,
              [conversation.id, side],
            );
            const cycles = await tx.query<{
              cycle_id: string;
              last_reminded_seq: string;
              last_reminder_at: Date | null;
              revision: string;
              last_read_seq: string;
            }>(
              `SELECT cy.cycle_id,cy.last_reminded_seq::text,cy.last_reminder_at,
                cy.revision::text,r.last_read_seq::text
               FROM public.message_reminder_cycles cy
               JOIN public.conversation_reads r ON r.conversation_id=cy.conversation_id
                 AND r.side=cy.side
               WHERE cy.conversation_id=$1 AND cy.side=$2 FOR UPDATE OF cy`,
              [conversation.id, side],
            );
            const cycle = cycles.rows[0];
            if (!cycle) throw new Error("MESSAGE_REMINDER_CYCLE_MISSING");
            const unread = await tx.query<{
              first_at: Date | null;
              eligible_seq: string | null;
            }>(
              `SELECT min(m.created_at) AS first_at,
                max(m.sequence_number) FILTER (WHERE m.created_at<=statement_timestamp()-interval '30 minutes')::text AS eligible_seq
               FROM public.messages m WHERE m.conversation_id=$1
                 AND m.sequence_number>$2 AND m.sender_side<>$3`,
              [conversation.id, cycle.last_read_seq, side],
            );
            const first = unread.rows[0]?.first_at;
            if (!first) {
              if (cycle.last_reminder_at || Number(cycle.last_reminded_seq))
                await tx.query(
                  `UPDATE public.message_reminder_cycles SET cycle_id=$3,
                   last_reminded_seq=0,last_reminder_at=NULL,first_unread_at=NULL,
                   revision=revision+1 WHERE conversation_id=$1 AND side=$2`,
                  [conversation.id, side, randomUUID()],
                );
              continue;
            }
            const eligible = unread.rows[0]?.eligible_seq;
            if (
              !eligible ||
              Number(eligible) <= Number(cycle.last_reminded_seq)
            )
              continue;
            const recipients = await tx.query<{ id: string }>(
              side === "clinic"
                ? `SELECT a.id FROM public.clinics c JOIN public.accounts a ON a.id=c.account_id
                   WHERE c.id=$1 AND c.review_state='approved' AND NOT c.suspended
                     AND a.profile='clinic' AND a.lifecycle='active' AND NOT a.security_locked
                     AND NOT a.credential_reset_required`
                : `SELECT a.id FROM public.email_category_recipients r
                   JOIN public.accounts a ON a.id=r.account_id
                   WHERE r.category='message_reminder' AND a.profile='admin'
                     AND a.lifecycle='active' AND NOT a.security_locked
                     AND NOT a.credential_reset_required
                     AND EXISTS(SELECT 1 FROM public.account_grants g WHERE g.account_id=a.id
                       AND g.permission_code=$2)
                     AND ($3::boolean=false OR EXISTS(SELECT 1 FROM public.account_grants g
                       WHERE g.account_id=a.id AND g.permission_code='orders.read_logistics'))`,
              side === "clinic"
                ? [conversation.clinic_id]
                : [
                    conversation.clinic_id,
                    conversation.kind === "general"
                      ? "messaging.general.read"
                      : "messaging.order.read",
                    conversation.kind === "order",
                  ],
            );
            if (!recipients.rows.length) continue;
            const updated = await tx.query<{ revision: string }>(
              `UPDATE public.message_reminder_cycles SET last_reminded_seq=$3,
                 last_reminder_at=statement_timestamp(),first_unread_at=$4,
                 revision=revision+1 WHERE conversation_id=$1 AND side=$2
                 AND (last_reminder_at IS NULL OR
                   last_reminder_at<=statement_timestamp()-interval '24 hours')
                 RETURNING revision::text`,
              [conversation.id, side, eligible, first],
            );
            if (!updated.rows.length) continue;
            const eventId = randomUUID();
            await tx.query(
              `INSERT INTO public.outbox_events
                (id,type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,process_code,correlation_id)
               VALUES($1,'message_reminder','process',$2,$3,$4,'message_reminder',$5)`,
              [
                eventId,
                cycle.cycle_id,
                updated.rows[0]!.revision,
                conversation.clinic_id,
                randomUUID(),
              ],
            );
            await tx.query(
              "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
              [eventId],
            );
            for (const recipient of recipients.rows)
              await tx.query(
                `INSERT INTO public.notification_deliveries
                   (event_id,target_account_id,channel,purpose)
                 VALUES($1,$2,'email','message_reminder')
                 ON CONFLICT(event_id,target_account_id,channel,purpose) DO NOTHING`,
                [eventId, recipient.id],
              );
            created++;
          }
        }
        return { inspected: conversations.rows.length, created };
      });
    },
  };
}
