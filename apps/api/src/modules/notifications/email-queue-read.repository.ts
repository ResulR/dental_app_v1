import {
  EmailQueuePageSchema,
  EmailQueueQuerySchema,
} from "@dental-lab/contracts";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
type Actor = { accountId: string; sessionId: string };
export function createEmailQueueReadRepository(
  db: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async page(actor: Actor, raw: unknown) {
      const parsed = EmailQueueQuerySchema.safeParse(raw);
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
        if (identity?.profile !== "owner") return { kind: "denied" as const };
        // No address, patient, body, provider identifier, lease or resource ID.
        const rows = await tx.query<{
          id: string;
          created_at: Date | string;
          next_attempt_at: Date | string;
          last_attempt_at: Date | string | null;
          attempt_count: number;
          event_type: string;
          purpose: string;
          state: string;
          last_result: string | null;
          last_error_code: string | null;
          cancellation_code: string | null;
        }>(
          `SELECT d.id,d.created_at,e.type AS event_type,d.purpose,d.state,
             d.attempt_count,d.next_attempt_at,d.cancellation_code,
             last_attempt.result AS last_result,last_attempt.error_code AS last_error_code,
             last_attempt.occurred_at AS last_attempt_at
           FROM public.notification_deliveries d
           JOIN public.outbox_events e ON e.id=d.event_id
           LEFT JOIN LATERAL (
             SELECT n.result,n.error_code,n.occurred_at
             FROM public.notification_attempts n WHERE n.delivery_id=d.id
             ORDER BY n.attempt_number DESC LIMIT 1
           ) last_attempt ON true
           WHERE d.channel='email'
             AND ($1::text IS NULL OR d.state=$1)
             AND ($2::timestamptz IS NULL OR (d.created_at,d.id)<($2::timestamptz,$3::uuid))
           ORDER BY d.created_at DESC,d.id DESC LIMIT 51`,
          [
            parsed.data.state ?? null,
            parsed.data.before?.created_at ?? null,
            parsed.data.before?.id ?? null,
          ],
        );
        const iso = (value: Date | string) =>
          value instanceof Date ? value.toISOString() : value;
        const items = rows.rows.slice(0, 50).map((row) => ({
          id: row.id,
          created_at: iso(row.created_at),
          event_type: row.event_type,
          purpose: row.purpose,
          state: row.state,
          attempt_count: row.attempt_count,
          next_attempt_at: iso(row.next_attempt_at),
          last_result: row.last_result,
          last_error_code: row.last_error_code,
          last_attempt_at:
            row.last_attempt_at === null ? null : iso(row.last_attempt_at),
          cancellation_code: row.cancellation_code,
        }));
        const last = items.at(-1);
        return {
          kind: "result" as const,
          result: EmailQueuePageSchema.parse({
            items,
            next_before:
              rows.rows.length > 50 && last
                ? { created_at: last.created_at, id: last.id }
                : null,
          }),
        };
      });
    },
  };
}
export async function assertEmailQueueReadReady(db: DatabaseExecutor) {
  const r = await db.query(
    "SELECT has_table_privilege(current_user,'public.notification_deliveries','SELECT') AND has_table_privilege(current_user,'public.notification_attempts','SELECT') AND has_table_privilege(current_user,'public.outbox_events','SELECT') AS ready",
  );
  if (r.rows[0]?.ready !== true)
    throw new Error("EMAIL_QUEUE_READ_UNAVAILABLE");
}
