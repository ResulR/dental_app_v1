import { randomUUID } from "node:crypto";
import {
  MessageMutationSchema,
  MessageMutationResultSchema,
  MessageHistoryQuerySchema,
  MessageHistoryResultSchema,
  MessagingInboxQuerySchema,
  MessagingInboxPageSchema,
  GeneralConversationQuerySchema,
  GeneralConversationPageSchema,
  GeneralMessageQuerySchema,
  GeneralMessagePageSchema,
  GeneralReadCommandSchema,
  GeneralReadReceiptSchema,
  OrderConversationQuerySchema,
  OrderConversationResultSchema,
} from "@dental-lab/contracts";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
type Actor = { accountId: string; sessionId: string };
async function authority(
  tx: DatabaseExecutor,
  actor: Actor,
  kind: "general" | "order",
) {
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
    return identity.permissions.includes(
      kind === "general" ? "messaging.general.read" : "messaging.order.read",
    )
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
  kind: "general" | "order" = "general",
) {
  return {
    async conversations(actor: Actor, raw: unknown) {
      const parsed = GeneralConversationQuerySchema.safeParse(raw);
      if (kind !== "general") return { kind: "invalid" as const };
      if (!parsed.success) return { kind: "invalid" as const };
      return db.transaction(async (tx) => {
        const scope = await authority(tx, actor, kind);
        if (
          !scope ||
          (scope.clinicId &&
            parsed.data.clinic_id &&
            scope.clinicId !== parsed.data.clinic_id)
        )
          return { kind: "denied" as const };
        const rows = await tx.query(
          `SELECT c.id,c.clinic_id,k.name AS clinic_name,c.last_message_seq::text,
               r.last_read_seq::text,
               (SELECT count(*)::text FROM public.messages m WHERE m.conversation_id=c.id
                  AND m.sequence_number>r.last_read_seq AND m.sender_side<>$3) AS unread_count
             FROM public.conversations c JOIN public.clinics k ON k.id=c.clinic_id
             LEFT JOIN public.conversation_reads r ON r.conversation_id=c.id AND r.side=$3
             WHERE c.kind='general' AND ($1::uuid IS NULL OR c.clinic_id=$1)
               AND ($2::uuid IS NULL OR c.id>$2)
             ORDER BY c.id LIMIT 51`,
          [
            scope.clinicId ?? parsed.data.clinic_id ?? null,
            parsed.data.after ?? null,
            scope.side,
          ],
        );
        if (rows.rows.some((row) => row.last_read_seq === null))
          return { kind: "unavailable" as const };
        const items = rows.rows.slice(0, 50).map((row) => ({
          id: row.id,
          clinic_id: row.clinic_id,
          clinic_name: row.clinic_name,
          last_message_seq: Number(row.last_message_seq),
          unread_count: Number(row.unread_count),
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
    async orderConversation(actor: Actor, raw: unknown) {
      const parsed = OrderConversationQuerySchema.safeParse(raw);
      if (!parsed.success || kind !== "order")
        return { kind: "invalid" as const };
      return db.transaction(async (tx) => {
        const scope = await authority(tx, actor, kind);
        if (!scope) return { kind: "denied" as const };
        const rows = await tx.query(
          `SELECT c.id,c.order_id,c.clinic_id,c.closed_at,c.last_message_seq::text,
             own.last_read_seq::text,other.side AS other_side,
             (SELECT count(*)::text FROM public.messages m WHERE m.conversation_id=c.id
                AND m.sequence_number>own.last_read_seq AND m.sender_side<>$3) AS unread_count
           FROM public.conversations c
           LEFT JOIN public.conversation_reads own ON own.conversation_id=c.id AND own.side=$3
           LEFT JOIN public.conversation_reads other ON other.conversation_id=c.id AND other.side<>$3
           WHERE c.kind='order' AND c.order_id=$1
             AND ($2::uuid IS NULL OR c.clinic_id=$2)`,
          [parsed.data.order_id, scope.clinicId, scope.side],
        );
        if (rows.rows.length !== 1) return { kind: "denied" as const };
        const row = rows.rows[0]!;
        if (row.last_read_seq === null || row.other_side === null)
          return { kind: "unavailable" as const };
        return {
          kind: "result" as const,
          result: OrderConversationResultSchema.parse({
            id: row.id,
            order_id: row.order_id,
            clinic_id: row.clinic_id,
            closed: row.closed_at !== null,
            last_message_seq: Number(row.last_message_seq),
            unread_count: Number(row.unread_count),
          }),
        };
      });
    },
    async messages(actor: Actor, raw: unknown) {
      const parsed = GeneralMessageQuerySchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return db.transaction(async (tx) => {
        const scope = await authority(tx, actor, kind);
        if (!scope) return { kind: "denied" as const };
        const conversation = await tx.query(
          "SELECT clinic_id,last_message_seq::text FROM public.conversations WHERE id=$1 AND kind=$3 AND ($2::uuid IS NULL OR clinic_id=$2) FOR SHARE",
          [parsed.data.conversation_id, scope.clinicId, kind],
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
        const forward = parsed.data.after_seq !== undefined;
        const rows = await tx.query(
          `SELECT m.id,m.sequence_number::text,m.sender_side,m.created_at,m.sender_id,m.revision::text,
             CASE WHEN m.hidden_at IS NULL THEN v.body ELSE NULL END AS body,
             (m.hidden_at IS NOT NULL) AS hidden,(v.version_number>1) AS edited
             FROM public.messages m JOIN public.message_versions v ON v.id=m.current_version_id AND v.message_id=m.id
             WHERE m.conversation_id=$1 AND m.clinic_id=$2
               AND ($3::bigint IS NULL OR m.sequence_number<$3)
               AND ($4::bigint IS NULL OR m.sequence_number>$4)
             ORDER BY m.sequence_number ${forward ? "ASC" : "DESC"} LIMIT 51`,
          [
            parsed.data.conversation_id,
            conversation.rows[0]!.clinic_id,
            parsed.data.before_seq ?? null,
            parsed.data.after_seq ?? null,
          ],
        );
        const messages = rows.rows.slice(0, 50).map((row) => ({
          id: row.id,
          sequence_number: Number(row.sequence_number),
          sender_side: row.sender_side,
          own: row.sender_id === actor.accountId,
          revision: Number(row.revision),
          body: row.body,
          created_at:
            row.created_at instanceof Date
              ? row.created_at.toISOString()
              : row.created_at,
          hidden: row.hidden,
          edited: row.edited,
        }));
        if (!forward) messages.reverse();
        return {
          kind: "result" as const,
          result: GeneralMessagePageSchema.parse({
            conversation_id: parsed.data.conversation_id,
            last_read_seq: Number(ownRead.last_read_seq),
            other_read_seq: Number(otherRead.last_read_seq),
            last_message_seq: Number(conversation.rows[0]!.last_message_seq),
            messages,
            next_before_seq:
              !forward && rows.rows.length > 50
                ? messages[0]!.sequence_number
                : null,
            next_after_seq:
              forward && rows.rows.length > 50
                ? messages.at(-1)!.sequence_number
                : null,
          }),
        };
      });
    },
    async mutate(actor: Actor, raw: unknown, action: "edit" | "hide") {
      const parsed = MessageMutationSchema.safeParse(raw);
      if (
        !parsed.success ||
        (action === "edit" ? !parsed.data.body : parsed.data.body !== undefined)
      )
        return { kind: "invalid" as const };
      const input = parsed.data;
      return db.transaction(async (tx) => {
        const scope = await authority(tx, actor, kind);
        if (!scope) return { kind: "denied" as const };
        if (scope.side === "laboratory") {
          const identity =
            await createCurrentPermissionsRepository(tx).current(actor);
          if (
            !identity?.permissions.includes(
              kind === "general"
                ? "messaging.general.reply"
                : "messaging.order.reply",
            )
          )
            return { kind: "denied" as const };
        }
        const conversations = await tx.query(
          "SELECT id,clinic_id,closed_at FROM public.conversations WHERE id=$1 AND kind=$3 AND ($2::uuid IS NULL OR clinic_id=$2) FOR UPDATE",
          [input.conversation_id, scope.clinicId, kind],
        );
        if (conversations.rows.length !== 1) return { kind: "denied" as const };
        const message = await tx.query(
          "SELECT id,revision::text,current_version_id,hidden_at FROM public.messages WHERE id=$1 AND conversation_id=$2 AND clinic_id=$3 AND sender_id=$4 FOR UPDATE",
          [
            input.message_id,
            input.conversation_id,
            conversations.rows[0]!.clinic_id,
            actor.accountId,
          ],
        );
        if (message.rows.length !== 1) return { kind: "denied" as const };
        const revision = Number(message.rows[0]!.revision);
        if (conversations.rows[0]!.closed_at !== null)
          return {
            kind: "result" as const,
            result: MessageMutationResultSchema.parse({
              kind: "closed",
              revision,
            }),
          };
        if (
          revision !== input.expected_revision ||
          message.rows[0]!.hidden_at !== null
        )
          return {
            kind: "result" as const,
            result: MessageMutationResultSchema.parse({
              kind: "conflict",
              revision,
            }),
          };
        const files = await tx.query(
          "SELECT 1 FROM public.message_version_files WHERE version_id=$1 LIMIT 1",
          [message.rows[0]!.current_version_id],
        );
        if (files.rows.length)
          return {
            kind: "result" as const,
            result: MessageMutationResultSchema.parse({
              kind: "conflict",
              revision,
            }),
          };
        const next = revision + 1;
        const versionId = randomUUID(),
          eventId = randomUUID(),
          requestId = randomUUID();
        if (action === "edit") {
          await tx.query(
            "INSERT INTO public.message_versions(id,message_id,clinic_id,version_number,created_by,body) VALUES($1,$2,$3,$4,$5,$6)",
            [
              versionId,
              input.message_id,
              conversations.rows[0]!.clinic_id,
              next,
              actor.accountId,
              input.body,
            ],
          );
          await tx.query(
            "UPDATE public.messages SET current_version_id=$2,revision=$3 WHERE id=$1",
            [input.message_id, versionId, next],
          );
        } else {
          await tx.query(
            "UPDATE public.messages SET hidden_at=statement_timestamp(),hidden_by=$2,revision=$3 WHERE id=$1",
            [input.message_id, actor.accountId, next],
          );
        }
        await tx.query(
          "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,actor_id,correlation_id) VALUES($1,$2,'message',$3,$4,$5,$6,$7)",
          [
            eventId,
            action === "edit" ? "message_edited" : "message_hidden",
            input.message_id,
            next,
            conversations.rows[0]!.clinic_id,
            actor.accountId,
            requestId,
          ],
        );
        await tx.query(
          "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
          [eventId],
        );
        await tx.query(
          "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,$2,'message',$3,$4,$5,$6::text[])",
          [
            actor.accountId,
            action === "edit" ? "MESSAGE_EDITED" : "MESSAGE_HIDDEN",
            input.message_id,
            requestId,
            next,
            action === "edit" ? ["version"] : ["lifecycle"],
          ],
        );
        return {
          kind: "result" as const,
          result: MessageMutationResultSchema.parse({
            kind: "updated",
            revision: next,
          }),
        };
      });
    },
    async history(actor: Actor, raw: unknown) {
      const parsed = MessageHistoryQuerySchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      const input = parsed.data;
      return db.transaction(async (tx) => {
        const scope = await authority(tx, actor, kind);
        if (!scope) return { kind: "denied" as const };
        const rows = await tx.query(
          "SELECT m.id FROM public.messages m JOIN public.conversations c ON c.id=m.conversation_id AND c.clinic_id=m.clinic_id WHERE m.id=$1 AND c.id=$2 AND c.kind=$4 AND m.sender_id=$5 AND ($3::uuid IS NULL OR c.clinic_id=$3)",
          [
            input.message_id,
            input.conversation_id,
            scope.clinicId,
            kind,
            actor.accountId,
          ],
        );
        if (rows.rows.length !== 1) return { kind: "denied" as const };
        const versions = await tx.query(
          "SELECT version_number::text,body,created_at FROM public.message_versions WHERE message_id=$1 AND ($2::bigint IS NULL OR version_number<$2) ORDER BY version_number DESC LIMIT 51",
          [input.message_id, input.before_version ?? null],
        );
        const visible = versions.rows.slice(0, 50).map((row) => ({
          version_number: Number(row.version_number),
          body: row.body,
          created_at:
            row.created_at instanceof Date
              ? row.created_at.toISOString()
              : row.created_at,
        }));
        return {
          kind: "result" as const,
          result: MessageHistoryResultSchema.parse({
            versions: visible,
            next_before_version:
              versions.rows.length > 50 ? visible[49]!.version_number : null,
          }),
        };
      });
    },
    async markRead(actor: Actor, raw: unknown) {
      const parsed = GeneralReadCommandSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return db.transaction(async (tx) => {
        const scope = await authority(tx, actor, kind);
        if (!scope) return { kind: "denied" as const };
        const conversation = await tx.query(
          "SELECT clinic_id,last_message_seq::text FROM public.conversations WHERE id=$1 AND kind=$3 AND ($2::uuid IS NULL OR clinic_id=$2) FOR SHARE",
          [parsed.data.conversation_id, scope.clinicId, kind],
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
export function createMessagingInboxRepository(
  db: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
  allowOrder: boolean,
) {
  return {
    async list(actor: Actor, raw: unknown) {
      const parsed = MessagingInboxQuerySchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      const input = parsed.data;
      return db.transaction(async (tx) => {
        const scope =
          (await authority(tx, actor, "general")) ??
          (await authority(tx, actor, "order"));
        if (!scope || scope.side !== "laboratory")
          return { kind: "denied" as const };
        const identity =
          await createCurrentPermissionsRepository(tx).current(actor);
        if (!identity) return { kind: "denied" as const };
        const canGeneral = identity.permissions.includes(
          "messaging.general.read",
        );
        const canOrder =
          allowOrder && identity.permissions.includes("messaging.order.read");
        if (!canGeneral && !canOrder) return { kind: "denied" as const };
        const rows = await tx.query(
          `SELECT c.id AS conversation_id,c.clinic_id,k.name AS clinic_name,c.kind,c.order_id,
               o.number::text AS order_number,c.closed_at,
               COALESCE(last_message.created_at,c.created_at) AS activity_at,
               r.last_read_seq::text,other.side AS other_side,
               (SELECT count(*)::text FROM public.messages m WHERE m.conversation_id=c.id
                  AND m.sender_side='clinic' AND m.sequence_number>r.last_read_seq) AS unread_count
           FROM public.conversations c JOIN public.clinics k ON k.id=c.clinic_id
           LEFT JOIN public.orders o ON o.id=c.order_id AND o.clinic_id=c.clinic_id
           LEFT JOIN public.conversation_reads r ON r.conversation_id=c.id AND r.side='laboratory'
           LEFT JOIN public.conversation_reads other ON other.conversation_id=c.id AND other.side='clinic'
           LEFT JOIN LATERAL (
             SELECT m.created_at FROM public.messages m WHERE m.conversation_id=c.id
             ORDER BY m.sequence_number DESC LIMIT 1
           ) last_message ON true
           WHERE ((c.kind='general' AND $1::boolean) OR (c.kind='order' AND $2::boolean))
             AND ($3::text IS NULL OR position(lower($3) in lower(k.name))>0 OR o.number::text=$3)
             AND ($4::text IS NULL OR c.kind=$4)
             AND (NOT $5::boolean OR r.last_read_seq IS NULL OR EXISTS (
               SELECT 1 FROM public.messages unread WHERE unread.conversation_id=c.id
                 AND unread.sender_side='clinic' AND unread.sequence_number>r.last_read_seq
             ))
             AND ($6::timestamptz IS NULL OR
                  (COALESCE(last_message.created_at,c.created_at),c.id)<($6::timestamptz,$7::uuid))
           ORDER BY activity_at DESC,c.id DESC LIMIT 51`,
          [
            canGeneral,
            canOrder,
            input.search || null,
            input.kind ?? null,
            input.unread_only ?? false,
            input.before_at ?? null,
            input.before_id ?? null,
          ],
        );
        if (
          rows.rows.some(
            (row) => row.last_read_seq === null || row.other_side === null,
          )
        )
          return { kind: "unavailable" as const };
        const items = rows.rows.slice(0, 50).map((row) => ({
          conversation_id: row.conversation_id,
          clinic_id: row.clinic_id,
          clinic_name: row.clinic_name,
          kind: row.kind,
          order_id: row.order_id,
          order_number: row.order_number,
          unread_count: Number(row.unread_count),
          activity_at:
            row.activity_at instanceof Date
              ? row.activity_at.toISOString()
              : row.activity_at,
          closed: row.closed_at !== null,
        }));
        const last = rows.rows.length > 50 ? items[49]! : null;
        return {
          kind: "result" as const,
          result: MessagingInboxPageSchema.parse({
            items,
            next_before_at: last?.activity_at ?? null,
            next_before_id: last?.conversation_id ?? null,
          }),
        };
      });
    },
  };
}
export async function assertGeneralMessagingReady(db: DatabaseExecutor) {
  const result = await db.query(
    "SELECT has_table_privilege(current_user,'public.conversations','SELECT') AND has_column_privilege(current_user,'public.conversations','last_message_seq','UPDATE') AND has_column_privilege(current_user,'public.conversations','revision','UPDATE') AND has_table_privilege(current_user,'public.messages','SELECT') AND has_table_privilege(current_user,'public.messages','INSERT') AND has_column_privilege(current_user,'public.messages','current_version_id','UPDATE') AND has_column_privilege(current_user,'public.messages','revision','UPDATE') AND has_column_privilege(current_user,'public.messages','hidden_at','UPDATE') AND has_column_privilege(current_user,'public.messages','hidden_by','UPDATE') AND has_table_privilege(current_user,'public.message_versions','SELECT') AND has_table_privilege(current_user,'public.message_versions','INSERT') AND has_table_privilege(current_user,'public.conversation_reads','SELECT') AND has_column_privilege(current_user,'public.conversation_reads','last_read_seq','UPDATE') AND has_column_privilege(current_user,'public.conversation_reads','read_by','UPDATE') AND has_column_privilege(current_user,'public.conversation_reads','read_at','UPDATE') AND has_column_privilege(current_user,'public.conversation_reads','revision','UPDATE') AND has_table_privilege(current_user,'public.outbox_events','INSERT') AND has_table_privilege(current_user,'public.outbox_dispatches','INSERT') AND has_table_privilege(current_user,'public.audit_events','INSERT') AS ready",
  );
  if (result.rows[0]?.ready !== true)
    throw new Error("GENERAL_MESSAGING_STORAGE_NOT_READY");
}
