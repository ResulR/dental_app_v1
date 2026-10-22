import {
  GeneralConversationQuerySchema,
  GeneralConversationPageSchema,
  GeneralMessageQuerySchema,
  GeneralMessagePageSchema,
  GeneralReadCommandSchema,
  GeneralReadReceiptSchema,
} from "@dental-lab/contracts";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
type Actor = { accountId: string; sessionId: string };
async function authority(tx: DatabaseExecutor, actor: Actor) {
  await tx.query("SELECT id FROM public.accounts WHERE id=$1 FOR SHARE", [
    actor.accountId,
  ]);
  await tx.query("LOCK TABLE public.account_grants IN SHARE MODE");
  await tx.query(
    "SELECT id FROM public.sessions WHERE id=$1 AND account_id=$2 FOR SHARE",
    [actor.sessionId, actor.accountId],
  );
  await tx.query(
    "SELECT id FROM public.clinics WHERE account_id=$1 FOR SHARE",
    [actor.accountId],
  );
  const identity = await createCurrentPermissionsRepository(tx).current(actor);
  if (!identity) return null;
  if (identity.profile !== "clinic") {
    return identity.permissions.includes("messaging.general.read")
      ? { clinicId: null, side: "laboratory" as const }
      : null;
  }
  const clinic = await tx.query(
    "SELECT id FROM public.clinics WHERE account_id=$1 AND review_state='approved' AND NOT suspended",
    [actor.accountId],
  );
  return clinic.rows.length === 1
    ? { clinicId: String(clinic.rows[0]!.id), side: "clinic" as const }
    : null;
}
export function createGeneralMessagingRepository(
  db: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async conversations(actor: Actor, raw: unknown) {
      const parsed = GeneralConversationQuerySchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return db.transaction(async (tx) => {
        const scope = await authority(tx, actor);
        if (
          !scope ||
          (scope.clinicId &&
            parsed.data.clinic_id &&
            scope.clinicId !== parsed.data.clinic_id)
        )
          return { kind: "denied" as const };
        const rows = await tx.query(
          `SELECT c.id,c.clinic_id,k.name AS clinic_name,c.last_message_seq::text
             FROM public.conversations c JOIN public.clinics k ON k.id=c.clinic_id
             WHERE c.kind='general' AND ($1::uuid IS NULL OR c.clinic_id=$1)
               AND ($2::uuid IS NULL OR c.id>$2)
             ORDER BY c.id LIMIT 51`,
          [
            scope.clinicId ?? parsed.data.clinic_id ?? null,
            parsed.data.after ?? null,
          ],
        );
        const items = rows.rows.slice(0, 50).map((row) => ({
          id: row.id,
          clinic_id: row.clinic_id,
          clinic_name: row.clinic_name,
          last_message_seq: Number(row.last_message_seq),
        }));
        return {
          kind: "result" as const,
          result: GeneralConversationPageSchema.parse({
            items,
            next_after: rows.rows.length > 50 ? items[49]!.id : null,
          }),
        };
      });
    },
    async messages(actor: Actor, raw: unknown) {
      const parsed = GeneralMessageQuerySchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return db.transaction(async (tx) => {
        const scope = await authority(tx, actor);
        if (!scope) return { kind: "denied" as const };
        const conversation = await tx.query(
          "SELECT clinic_id FROM public.conversations WHERE id=$1 AND kind='general' AND ($2::uuid IS NULL OR clinic_id=$2) FOR SHARE",
          [parsed.data.conversation_id, scope.clinicId],
        );
        if (conversation.rows.length !== 1) return { kind: "denied" as const };
        const reads = await tx.query(
          "SELECT side,last_read_seq::text FROM public.conversation_reads WHERE conversation_id=$1 ORDER BY side",
          [parsed.data.conversation_id],
        );
        if (reads.rows.length !== 2) return { kind: "unavailable" as const };
        const ownRead = reads.rows.find((row) => row.side === scope.side);
        const otherRead = reads.rows.find((row) => row.side !== scope.side);
        if (!ownRead || !otherRead) return { kind: "unavailable" as const };
        const rows = await tx.query(
          `SELECT m.id,m.sequence_number::text,m.sender_side,m.created_at,
             CASE WHEN m.hidden_at IS NULL THEN v.body ELSE NULL END AS body,
             (m.hidden_at IS NOT NULL) AS hidden,(m.revision>1) AS edited
             FROM public.messages m JOIN public.message_versions v ON v.id=m.current_version_id AND v.message_id=m.id
             WHERE m.conversation_id=$1 AND m.clinic_id=$2
               AND ($3::bigint IS NULL OR m.sequence_number<$3)
             ORDER BY m.sequence_number DESC LIMIT 51`,
          [
            parsed.data.conversation_id,
            conversation.rows[0]!.clinic_id,
            parsed.data.before_seq ?? null,
          ],
        );
        const messages = rows.rows
          .slice(0, 50)
          .map((row) => ({
            id: row.id,
            sequence_number: Number(row.sequence_number),
            sender_side: row.sender_side,
            body: row.body,
            created_at:
              row.created_at instanceof Date
                ? row.created_at.toISOString()
                : row.created_at,
            hidden: row.hidden,
            edited: row.edited,
          }))
          .reverse();
        return {
          kind: "result" as const,
          result: GeneralMessagePageSchema.parse({
            conversation_id: parsed.data.conversation_id,
            last_read_seq: Number(ownRead.last_read_seq),
            other_read_seq: Number(otherRead.last_read_seq),
            messages,
            next_before_seq:
              rows.rows.length > 50 ? messages[0]!.sequence_number : null,
          }),
        };
      });
    },
    async markRead(actor: Actor, raw: unknown) {
      const parsed = GeneralReadCommandSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return db.transaction(async (tx) => {
        const scope = await authority(tx, actor);
        if (!scope) return { kind: "denied" as const };
        const conversation = await tx.query(
          "SELECT clinic_id,last_message_seq::text FROM public.conversations WHERE id=$1 AND kind='general' AND ($2::uuid IS NULL OR clinic_id=$2) FOR SHARE",
          [parsed.data.conversation_id, scope.clinicId],
        );
        if (conversation.rows.length !== 1) return { kind: "denied" as const };
        const read = await tx.query(
          "SELECT last_read_seq::text FROM public.conversation_reads WHERE conversation_id=$1 AND side=$2 FOR UPDATE",
          [parsed.data.conversation_id, scope.side],
        );
        if (read.rows.length !== 1) return { kind: "unavailable" as const };
        const previous = Number(read.rows[0]!.last_read_seq);
        const through = parsed.data.through_seq;
        if (through > Number(conversation.rows[0]!.last_message_seq))
          return { kind: "invalid" as const };
        if (through > previous) {
          const exists = await tx.query(
            "SELECT 1 FROM public.messages WHERE conversation_id=$1 AND clinic_id=$2 AND sequence_number=$3",
            [
              parsed.data.conversation_id,
              conversation.rows[0]!.clinic_id,
              through,
            ],
          );
          if (exists.rows.length !== 1) return { kind: "invalid" as const };
          await tx.query(
            "UPDATE public.conversation_reads SET last_read_seq=$3,read_by=$4,read_at=statement_timestamp(),revision=revision+1 WHERE conversation_id=$1 AND side=$2",
            [parsed.data.conversation_id, scope.side, through, actor.accountId],
          );
        }
        return {
          kind: "result" as const,
          result: GeneralReadReceiptSchema.parse({
            conversation_id: parsed.data.conversation_id,
            last_read_seq: Math.max(previous, through),
          }),
        };
      });
    },
  };
}
export async function assertGeneralMessagingReady(db: DatabaseExecutor) {
  const result = await db.query(
    "SELECT has_table_privilege(current_user,'public.conversations','SELECT') AND has_column_privilege(current_user,'public.conversations','last_message_seq','UPDATE') AND has_column_privilege(current_user,'public.conversations','revision','UPDATE') AND has_table_privilege(current_user,'public.messages','SELECT') AND has_table_privilege(current_user,'public.messages','INSERT') AND has_table_privilege(current_user,'public.message_versions','SELECT') AND has_table_privilege(current_user,'public.message_versions','INSERT') AND has_table_privilege(current_user,'public.conversation_reads','SELECT') AND has_column_privilege(current_user,'public.conversation_reads','last_read_seq','UPDATE') AND has_column_privilege(current_user,'public.conversation_reads','read_by','UPDATE') AND has_column_privilege(current_user,'public.conversation_reads','read_at','UPDATE') AND has_column_privilege(current_user,'public.conversation_reads','revision','UPDATE') AND has_table_privilege(current_user,'public.outbox_events','INSERT') AND has_table_privilege(current_user,'public.outbox_dispatches','INSERT') AND has_table_privilege(current_user,'public.audit_events','INSERT') AS ready",
  );
  if (result.rows[0]?.ready !== true)
    throw new Error("GENERAL_MESSAGING_STORAGE_NOT_READY");
}
