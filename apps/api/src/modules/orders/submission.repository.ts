import { createHash, randomUUID } from "node:crypto";
import {
  OrderSubmissionSchema,
  OrderSubmissionResultSchema,
} from "@dental-lab/contracts";
import type { createApplicationDatabase } from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
import { readCatalogForUse } from "../catalog/index.js";
import { prepareNewOrderFiles } from "../files/index.js";
import { draftMatchesSubmission } from "./submission-draft.js";
import type { AttachmentPolicy } from "../files/index.js";
type Actor = { accountId: string; sessionId: string };
// No retry here: a lost COMMIT response must be reconciled using the same receipt key.
export function createOrderSubmissionRepository(
  database: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
  attachmentPolicy?: AttachmentPolicy,
  internalNotices = false,
) {
  return {
    async submit(actor: Actor, raw: unknown) {
      const parsed = OrderSubmissionSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      const {
        input,
        idempotency_key,
        confirmed_warnings,
        draft_id,
        draft_revision,
      } = parsed.data;
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify(
            draft_id
              ? {
                  input: {
                    ...input,
                    teeth: [...input.teeth].sort((a, b) => a.fdi - b.fdi),
                  },
                  draft_id,
                  draft_revision,
                }
              : {
                  ...input,
                  teeth: [...input.teeth].sort((a, b) => a.fdi - b.fdi),
                },
          ),
        )
        .digest();
      return database.transaction(async (tx) => {
        // Account serialization covers all sessions of the clinic, including first receipt insertion.
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
        if (identity?.profile !== "clinic") return { kind: "denied" as const };
        const clinics = await tx.query(
          "SELECT id FROM public.clinics WHERE account_id=$1 AND review_state='approved' AND NOT suspended",
          [actor.accountId],
        );
        if (clinics.rows.length !== 1) return { kind: "denied" as const };
        const clinicId = clinics.rows[0]!.id;
        const previous = await tx.query(
          "SELECT r.id AS receipt_id,r.payload_fingerprint,o.id AS order_id,o.number::text,o.received_at FROM public.submission_receipts r JOIN public.orders o ON o.id=r.order_id AND o.clinic_id=r.clinic_id WHERE r.account_id=$1 AND r.intent='clinic_order' AND r.idempotency_key=$2 AND r.clinic_id=$3",
          [actor.accountId, idempotency_key, clinicId],
        );
        const receipt = (row: Record<string, unknown>, replayed: boolean) =>
          OrderSubmissionResultSchema.parse({
            kind: "submitted",
            persisted: true,
            order_id: row.order_id,
            number: row.number,
            received_at:
              row.received_at instanceof Date
                ? row.received_at.toISOString()
                : row.received_at,
            replayed,
          });
        if (previous.rows.length) {
          const row = previous.rows[0]!;
          if (
            !Buffer.isBuffer(row.payload_fingerprint) ||
            !row.payload_fingerprint.equals(fingerprint)
          )
            return {
              kind: "result" as const,
              result: OrderSubmissionResultSchema.parse({
                kind: "conflict",
                persisted: false,
              }),
            };
          if (draft_id) {
            const linked = await tx.query(
              "SELECT id FROM public.drafts WHERE id=$1 AND account_id=$2 AND clinic_id=$3 AND state='submitted' AND submission_receipt_id=$4",
              [draft_id, actor.accountId, clinicId, row.receipt_id],
            );
            if (linked.rows.length !== 1)
              return {
                kind: "result" as const,
                result: OrderSubmissionResultSchema.parse({
                  kind: "draft_conflict",
                  persisted: false,
                }),
              };
          }
          return { kind: "result" as const, result: receipt(row, true) };
        }
        if (draft_id) {
          const draft = await tx.query<{
            revision: string;
            state: string;
            payload: unknown;
          }>(
            `SELECT d.revision::text,d.state,r.payload FROM public.drafts d
             JOIN public.draft_revisions r ON r.draft_id=d.id AND r.revision=d.revision
             WHERE d.id=$1 AND d.account_id=$2 AND d.clinic_id=$3 FOR UPDATE OF d`,
            [draft_id, actor.accountId, clinicId],
          );
          const current = draft.rows[0];
          if (
            !current ||
            current.state !== "active" ||
            current.revision !== String(draft_revision) ||
            !draftMatchesSubmission(current.payload, input)
          )
            return {
              kind: "result" as const,
              result: OrderSubmissionResultSchema.parse({
                kind: "draft_conflict",
                persisted: false,
              }),
            };
          const draftFiles = await tx.query(
            `SELECT file_id FROM public.draft_revision_files f
             JOIN public.draft_revisions r ON r.id=f.revision_id
             WHERE r.draft_id=$1 AND r.revision=$2 LIMIT 1`,
            [draft_id, draft_revision],
          );
          if (draftFiles.rows.length || input.file_ids.length)
            return {
              kind: "result" as const,
              result: OrderSubmissionResultSchema.parse({
                kind: "blocked",
                persisted: false,
                reasons: ["files_not_ready"],
              }),
            };
        }
        const { missing, references } = await readCatalogForUse(tx, input);
        const reasons: (
          "catalog_missing" | "catalog_forbidden" | "files_not_ready"
        )[] = [];
        // A deleted entry cannot be reconstructed from an untrusted browser label.
        if (missing || references.some((r) => !r.label?.trim()))
          reasons.push("catalog_missing");
        if (references.some((r) => r.state === "forbidden"))
          reasons.push("catalog_forbidden");
        const attachments = await prepareNewOrderFiles(
          tx,
          {
            actorId: actor.accountId,
            clinicId: String(clinicId),
            fileIds: input.file_ids,
            purpose: "initial_order",
            sourceOrderId: null,
          },
          attachmentPolicy,
        );
        if (!attachments) reasons.push("files_not_ready");
        if (reasons.length)
          return {
            kind: "result" as const,
            result: OrderSubmissionResultSchema.parse({
              kind: "blocked",
              persisted: false,
              reasons,
            }),
          };
        const warnings: ("catalog_unavailable" | "low_detail")[] = [];
        if (references.some((r) => r.state === "unavailable"))
          warnings.push("catalog_unavailable");
        if (!input.teeth.length && !input.description?.trim())
          warnings.push("low_detail");
        if (warnings.length && !confirmed_warnings)
          return {
            kind: "result" as const,
            result: OrderSubmissionResultSchema.parse({
              kind: "confirmation_required",
              persisted: false,
              warnings,
            }),
          };
        const snapshots = new Map<string, string>();
        for (const ref of references) {
          const snapshot = randomUUID();
          snapshots.set(ref.kind, snapshot);
          await tx.query(
            "INSERT INTO public.catalog_reference_snapshots(id,reference_id,kind,label,source_revision) VALUES($1,$2,$3,$4,$5)",
            [snapshot, ref.id, ref.kind, ref.label, ref.revision],
          );
        }
        const orderId = randomUUID(),
          versionId = randomUUID(),
          eventId = randomUUID(),
          requestId = randomUUID(),
          conversationId = randomUUID();
        const order = await tx.query(
          "INSERT INTO public.orders(id,clinic_id,kind,origin,created_by,status,revision,current_version_id) VALUES($1,$2,'normal','clinic',$3,'pending',1,$4) RETURNING id AS order_id,number::text,received_at",
          [orderId, clinicId, actor.accountId, versionId],
        );
        await tx.query(
          "INSERT INTO public.order_versions(id,order_id,clinic_id,order_kind,order_origin,version_number,created_by,patient_first_name,patient_last_name,patient_reference,material_snapshot_id,shade_snapshot_id,work_type_snapshot_id,description,requested_delivery_date) VALUES($1,$2,$3,'normal','clinic',1,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
          [
            versionId,
            orderId,
            clinicId,
            actor.accountId,
            input.patient.first_name ?? null,
            input.patient.last_name ?? null,
            input.patient.internal_reference ?? null,
            snapshots.get("material"),
            snapshots.get("shade"),
            snapshots.get("work_type") ?? null,
            input.description ?? null,
            input.requested_delivery_date,
          ],
        );
        for (const tooth of input.teeth)
          await tx.query(
            "INSERT INTO public.order_version_teeth(version_id,order_id,clinic_id,fdi,selection) VALUES($1,$2,$3,$4,$5)",
            [versionId, orderId, clinicId, tooth.fdi, tooth.selection],
          );
        if (!attachments) throw new Error("ATTACHMENT_PLAN_MISSING");
        await attachments.attach(orderId, versionId);
        await tx.query(
          "INSERT INTO public.order_logistics(order_id,clinic_id) VALUES($1,$2)",
          [orderId, clinicId],
        );
        await tx.query(
          "INSERT INTO public.order_status_events(order_id,clinic_id,previous_status,next_status,actor_id,decided_version_id,aggregate_revision) VALUES($1,$2,NULL,'pending',$3,$4,1)",
          [orderId, clinicId, actor.accountId, versionId],
        );
        await tx.query(
          "INSERT INTO public.conversations(id,clinic_id,kind,order_id) VALUES($1,$2,'order',$3)",
          [conversationId, clinicId, orderId],
        );
        await tx.query(
          "INSERT INTO public.conversation_reads(conversation_id,side) VALUES($1,'clinic'),($1,'laboratory')",
          [conversationId],
        );
        await tx.query(
          "INSERT INTO public.message_reminder_cycles(conversation_id,side) VALUES($1,'clinic'),($1,'laboratory')",
          [conversationId],
        );
        await tx.query(
          "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,actor_id,correlation_id) VALUES($1,'order_submitted','order',$2,1,$3,$4,$5)",
          [eventId, orderId, clinicId, actor.accountId, requestId],
        );
        await tx.query(
          "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
          [eventId],
        );
        if (internalNotices) {
          const notice = await tx.query(
            "INSERT INTO public.internal_notifications(event_id,target_account_id) SELECT $1,a.id FROM public.owner_slot s JOIN public.accounts a ON a.id=s.account_id WHERE s.singleton=1 AND a.profile='owner' AND a.lifecycle='active' AND NOT a.security_locked AND NOT a.credential_reset_required RETURNING id",
            [eventId],
          );
          if (notice.rows.length !== 1)
            throw new Error("ORDER_OWNER_NOTIFICATION_UNAVAILABLE");
        }
        await tx.query(
          "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,'ORDER_SUBMITTED','order',$2,$3,1,ARRAY['status','version'])",
          [actor.accountId, orderId, requestId],
        );
        const persistedReceipt = await tx.query<{ id: string }>(
          "INSERT INTO public.submission_receipts(account_id,intent,idempotency_key,payload_fingerprint,order_id,clinic_id) VALUES($1,'clinic_order',$2,$3,$4,$5) RETURNING id",
          [actor.accountId, idempotency_key, fingerprint, orderId, clinicId],
        );
        if (draft_id) {
          if (persistedReceipt.rows.length !== 1)
            throw new Error("ORDER_RECEIPT_MISSING");
          const linked = await tx.query(
            `WITH changed AS (
              UPDATE public.drafts SET revision=revision+1,state='submitted',
                submission_receipt_id=$4,updated_at=CURRENT_TIMESTAMP
              WHERE id=$1 AND account_id=$2 AND clinic_id=$3
                AND revision=$5 AND state='active'
              RETURNING id,account_id,clinic_id,revision
            ), history AS (
              INSERT INTO public.draft_revisions(draft_id,account_id,clinic_id,revision,schema_version,payload)
              SELECT c.id,c.account_id,c.clinic_id,c.revision,r.schema_version,r.payload
              FROM changed c JOIN public.draft_revisions r
                ON r.draft_id=c.id AND r.revision=c.revision-1
              RETURNING draft_id
            ) SELECT draft_id FROM history`,
            [
              draft_id,
              actor.accountId,
              clinicId,
              persistedReceipt.rows[0]!.id,
              draft_revision,
            ],
          );
          if (linked.rows.length !== 1)
            throw new Error("DRAFT_SUBMISSION_LINK_MISSING");
        }
        if (order.rows.length !== 1) throw new Error("ORDER_RECEIPT_MISSING");
        return {
          kind: "result" as const,
          result: receipt(order.rows[0]!, false),
        };
      });
    },
  };
}
