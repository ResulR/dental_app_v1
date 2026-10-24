import { createHash, randomUUID } from "node:crypto";
import {
  MessageSubmissionSchema,
  MessageSubmissionResultSchema,
} from "@dental-lab/contracts";
import type { createApplicationDatabase } from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
import { prepareMessageFiles } from "../files/index.js";
import type { AttachmentPolicy } from "../files/index.js";
type Actor = { accountId: string; sessionId: string };
// General text-only runtime uses generalOnly=true; file bindings stay unmounted.
export function createMessageSubmissionRepository(
  db: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
  attachmentPolicy?: AttachmentPolicy,
  textKind: false | true | "order" = false,
  internalNotices = false,
) {
  return {
    async send(actor: Actor, raw: unknown) {
      const parsed = MessageSubmissionSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      const input = parsed.data;
      if (textKind && (input.body === null || input.file_ids.length))
        return { kind: "invalid" as const };
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify({
            body: input.body,
            file_ids: [...input.file_ids].sort(),
          }),
        )
        .digest();
      return db.transaction(async (tx) => {
        await tx.query(
          "SELECT id FROM public.accounts WHERE id=$1 FOR UPDATE",
          [actor.accountId],
        );
        await tx.query("LOCK TABLE public.account_grants IN SHARE MODE");
        await tx.query(
          "SELECT id FROM public.sessions WHERE id=$1 AND account_id=$2 FOR SHARE",
          [actor.sessionId, actor.accountId],
        );
        await tx.query(
          "SELECT id FROM public.clinics WHERE account_id=$1 FOR SHARE",
          [actor.accountId],
        );
        const identity =
          await createCurrentPermissionsRepository(tx).current(actor);
        if (!identity) return { kind: "denied" as const };
        let clinicId: string | null = null;
        if (identity.profile === "clinic") {
          const scoped = await tx.query(
            "SELECT id FROM public.clinics WHERE account_id=$1 AND review_state='approved' AND NOT suspended",
            [actor.accountId],
          );
          if (scoped.rows.length !== 1) return { kind: "denied" as const };
          clinicId = String(scoped.rows[0]!.id);
        }
        // One exclusive lock serializes sequence, receipts, closure and bindings.
        const conversations = await tx.query(
          "SELECT id,clinic_id,kind,order_id,closed_at,last_message_seq::text FROM public.conversations WHERE id=$1 AND ($2::uuid IS NULL OR clinic_id=$2) FOR UPDATE",
          [input.conversation_id, clinicId],
        );
        const conversation = conversations.rows[0];
        if (
          !conversation ||
          (textKind &&
            conversation.kind !== (textKind === "order" ? "order" : "general"))
        )
          return { kind: "denied" as const };
        if (identity.profile !== "clinic") {
          const permission =
            conversation.kind === "order"
              ? "messaging.order.reply"
              : "messaging.general.reply";
          if (!identity.permissions.includes(permission))
            return { kind: "denied" as const };
          if (
            input.file_ids.length &&
            !identity.permissions.includes("files.view")
          )
            return { kind: "denied" as const };
        }
        const existing = await tx.query(
          "SELECT id,current_version_id,sequence_number::text,created_at,payload_fingerprint FROM public.messages WHERE sender_id=$1 AND conversation_id=$2 AND idempotency_key=$3",
          [actor.accountId, input.conversation_id, input.idempotency_key],
        );
        const receipt = (row: Record<string, unknown>, replayed: boolean) =>
          MessageSubmissionResultSchema.parse({
            kind: "sent",
            persisted: true,
            message_id: row.id,
            version_id: row.current_version_id,
            sequence_number: Number(row.sequence_number),
            created_at:
              row.created_at instanceof Date
                ? row.created_at.toISOString()
                : row.created_at,
            replayed,
          });
        if (existing.rows.length) {
          const previous = existing.rows[0]!;
          if (
            !Buffer.isBuffer(previous.payload_fingerprint) ||
            !previous.payload_fingerprint.equals(fingerprint)
          )
            return {
              kind: "result" as const,
              result: MessageSubmissionResultSchema.parse({
                kind: "conflict",
                persisted: false,
              }),
            };
          return { kind: "result" as const, result: receipt(previous, true) };
        }
        if (
          conversation.closed_at !== null ||
          (conversation.kind === "order" && !conversation.order_id) ||
          (conversation.kind === "general" && conversation.order_id !== null)
        )
          return {
            kind: "result" as const,
            result: MessageSubmissionResultSchema.parse({
              kind: "conversation_closed",
              persisted: false,
            }),
          };
        const attachments = await prepareMessageFiles(
          tx,
          {
            actorId: actor.accountId,
            clinicId: String(conversation.clinic_id),
            conversationId: input.conversation_id,
            fileIds: input.file_ids,
          },
          attachmentPolicy,
        );
        if (!attachments)
          return {
            kind: "result" as const,
            result: MessageSubmissionResultSchema.parse({
              kind: "files_not_ready",
              persisted: false,
            }),
          };
        const messageId = randomUUID(),
          versionId = randomUUID(),
          eventId = randomUUID(),
          requestId = randomUUID();
        const seq = await tx.query(
          "UPDATE public.conversations SET last_message_seq=last_message_seq+1,revision=revision+1 WHERE id=$1 AND closed_at IS NULL RETURNING last_message_seq::text",
          [input.conversation_id],
        );
        if (seq.rows.length !== 1)
          throw new Error("MESSAGE_CONVERSATION_CONFLICT");
        const inserted = await tx.query(
          `INSERT INTO public.messages(id,conversation_id,clinic_id,sequence_number,sender_id,sender_side,current_version_id,idempotency_key,payload_fingerprint)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,current_version_id,sequence_number::text,created_at`,
          [
            messageId,
            input.conversation_id,
            conversation.clinic_id,
            seq.rows[0]!.last_message_seq,
            actor.accountId,
            identity.profile === "clinic" ? "clinic" : "laboratory",
            versionId,
            input.idempotency_key,
            fingerprint,
          ],
        );
        if (inserted.rows.length !== 1)
          throw new Error("MESSAGE_RECEIPT_MISSING");
        await tx.query(
          "INSERT INTO public.message_versions(id,message_id,clinic_id,version_number,created_by,body) VALUES($1,$2,$3,1,$4,$5)",
          [
            versionId,
            messageId,
            conversation.clinic_id,
            actor.accountId,
            input.body,
          ],
        );
        await attachments.attach(versionId);
        await tx.query(
          "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,actor_id,correlation_id) VALUES($1,'message_created','message',$2,1,$3,$4,$5)",
          [
            eventId,
            messageId,
            conversation.clinic_id,
            actor.accountId,
            requestId,
          ],
        );
        await tx.query(
          "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
          [eventId],
        );
        if (internalNotices) {
          if (identity.profile === "clinic") {
            // One row per currently eligible laboratory account; grants and their
            // prerequisites are serialized by the account_grants table lock above.
            await tx.query(
              `INSERT INTO public.internal_notifications(event_id,target_account_id)
               SELECT $1,a.id FROM public.accounts a
               WHERE a.id<>$2 AND a.lifecycle='active' AND NOT a.security_locked
                 AND NOT a.credential_reset_required AND (
                   (a.profile='owner' AND EXISTS(SELECT 1 FROM public.owner_slot s WHERE s.singleton=1 AND s.account_id=a.id))
                   OR (a.profile IN ('admin','employee')
                     AND EXISTS(SELECT 1 FROM public.account_grants g WHERE g.account_id=a.id AND g.permission_code=$3)
                     AND (NOT $4::boolean OR EXISTS(SELECT 1 FROM public.account_grants parent WHERE parent.account_id=a.id AND parent.permission_code='orders.read_logistics'))))
               ON CONFLICT(event_id,target_account_id) DO NOTHING`,
              [
                eventId,
                actor.accountId,
                conversation.kind === "general"
                  ? "messaging.general.read"
                  : "messaging.order.read",
                conversation.kind === "order",
              ],
            );
          } else {
            await tx.query(
              `INSERT INTO public.internal_notifications(event_id,target_account_id)
               SELECT $1,a.id FROM public.clinics c JOIN public.accounts a ON a.id=c.account_id
               WHERE c.id=$2 AND c.review_state='approved' AND NOT c.suspended
                 AND a.profile='clinic' AND a.id<>$3 AND a.lifecycle='active'
                 AND NOT a.security_locked AND NOT a.credential_reset_required
               ON CONFLICT(event_id,target_account_id) DO NOTHING`,
              [eventId, conversation.clinic_id, actor.accountId],
            );
          }
        }
        await tx.query(
          "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,'MESSAGE_CREATED','message',$2,$3,1,ARRAY['version'])",
          [actor.accountId, messageId, requestId],
        );
        return {
          kind: "result" as const,
          result: receipt(inserted.rows[0]!, false),
        };
      });
    },
  };
}
