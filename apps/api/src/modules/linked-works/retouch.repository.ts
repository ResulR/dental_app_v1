import { createHash, randomUUID } from "node:crypto";
import {
  RetouchSubmissionSchema,
  RetouchSubmissionResultSchema,
} from "@dental-lab/contracts";
import type { createApplicationDatabase } from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
import { readCatalogForUse } from "../catalog/index.js";
import { prepareNewOrderFiles } from "../files/index.js";
import type { AttachmentPolicy } from "../files/index.js";
type Actor = { accountId: string; sessionId: string };
// No retry here: a lost COMMIT response must be reconciled using the same receipt key.
export function createRetouchRepository(
  database: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
  attachmentPolicy?: AttachmentPolicy,
) {
  return {
    async submit(actor: Actor, raw: unknown) {
      const parsed = RetouchSubmissionSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      const {
        input: fields,
        idempotency_key,
        confirmed_warnings,
      } = parsed.data;
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify({
            ...fields,
          }),
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
          "SELECT r.payload_fingerprint,o.id AS order_id,o.number::text,o.received_at FROM public.submission_receipts r JOIN public.orders o ON o.id=r.order_id AND o.clinic_id=r.clinic_id WHERE r.account_id=$1 AND r.intent='clinic_retouch' AND r.idempotency_key=$2 AND r.clinic_id=$3",
          [actor.accountId, idempotency_key, clinicId],
        );
        const receipt = (row: Record<string, unknown>, replayed: boolean) =>
          RetouchSubmissionResultSchema.parse({
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
              result: RetouchSubmissionResultSchema.parse({
                kind: "conflict",
                persisted: false,
              }),
            };
          return { kind: "result" as const, result: receipt(row, true) };
        }
        const scoped = await tx.query(
          "SELECT id FROM public.orders WHERE id=$1 AND clinic_id=$2",
          [fields.source_order_id, clinicId],
        );
        if (scoped.rows.length !== 1) return { kind: "denied" as const };
        const { missing, references } = await readCatalogForUse(tx, fields);
        const sources = await tx.query(
          "SELECT id,status,current_version_id,revision::text FROM public.orders WHERE id=$1 AND clinic_id=$2 FOR UPDATE",
          [fields.source_order_id, clinicId],
        );
        const source = sources.rows[0];
        if (
          !source ||
          source.status !== "delivered" ||
          source.current_version_id !== fields.expected_source_version_id ||
          Number(source.revision) !== fields.expected_source_revision
        )
          return {
            kind: "result" as const,
            result: RetouchSubmissionResultSchema.parse({
              kind: "source_unavailable",
              persisted: false,
            }),
          };
        if (
          (
            await tx.query(
              "SELECT child_order_id FROM public.work_links WHERE source_order_id=$1 AND kind='retouch' AND child_current_status IN ('pending','correction_requested','accepted','manufacturing','completed') LIMIT 1",
              [source.id],
            )
          ).rows.length
        )
          return {
            kind: "result" as const,
            result: RetouchSubmissionResultSchema.parse({
              kind: "active_retouch",
              persisted: false,
            }),
          };
        const versions = await tx.query(
          "SELECT patient_first_name,patient_last_name,patient_reference FROM public.order_versions WHERE id=$1 AND order_id=$2 AND clinic_id=$3",
          [source.current_version_id, source.id, clinicId],
        );
        if (versions.rows.length !== 1)
          throw new Error("RETOUCH_SOURCE_VERSION_MISSING");
        const patient = versions.rows[0]!;
        const input = {
          ...fields,
          patient: {
            first_name: patient.patient_first_name,
            last_name: patient.patient_last_name,
            internal_reference: patient.patient_reference,
          },
          requested_delivery_date: null,
        };

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
            purpose: "retouch",
            sourceOrderId: fields.source_order_id,
          },
          attachmentPolicy,
        );
        if (!attachments) reasons.push("files_not_ready");
        if (reasons.length)
          return {
            kind: "result" as const,
            result: RetouchSubmissionResultSchema.parse({
              kind: "blocked",
              persisted: false,
              reasons,
            }),
          };
        const warnings: ("catalog_unavailable" | "low_detail")[] = [];
        if (references.some((r) => r.state === "unavailable"))
          warnings.push("catalog_unavailable");
        if (warnings.length && !confirmed_warnings)
          return {
            kind: "result" as const,
            result: RetouchSubmissionResultSchema.parse({
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
          "INSERT INTO public.orders(id,clinic_id,kind,origin,created_by,status,revision,current_version_id) VALUES($1,$2,'retouch','clinic',$3,'pending',1,$4) RETURNING id AS order_id,number::text,received_at",
          [orderId, clinicId, actor.accountId, versionId],
        );
        await tx.query(
          "INSERT INTO public.order_versions(id,order_id,clinic_id,order_kind,order_origin,version_number,created_by,patient_first_name,patient_last_name,patient_reference,material_snapshot_id,shade_snapshot_id,work_type_snapshot_id,description,requested_delivery_date) VALUES($1,$2,$3,'retouch','clinic',1,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
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
            null,
            input.description ?? null,
            input.requested_delivery_date,
          ],
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
          "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,actor_id,correlation_id) VALUES($1,'retouch_requested','order',$2,1,$3,$4,$5)",
          [eventId, orderId, clinicId, actor.accountId, requestId],
        );
        await tx.query(
          "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
          [eventId],
        );
        await tx.query(
          "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,'RETOUCH_REQUESTED','order',$2,$3,1,ARRAY['status','version'])",
          [actor.accountId, orderId, requestId],
        );
        const receiptId = randomUUID();
        await tx.query(
          "INSERT INTO public.submission_receipts(id,account_id,intent,idempotency_key,payload_fingerprint,order_id,clinic_id) VALUES($1,$2,'clinic_retouch',$3,$4,$5,$6)",
          [
            receiptId,
            actor.accountId,
            idempotency_key,
            fingerprint,
            orderId,
            clinicId,
          ],
        );
        await tx.query(
          "INSERT INTO public.work_links(source_order_id,child_order_id,clinic_id,kind,intervention_kind,child_current_status,source_revision,source_status_at_creation,created_by,idempotency_receipt_id) VALUES($1,$2,$3,'retouch',$4,'pending',$5,'delivered',$6,$7)",
          [
            source.id,
            orderId,
            clinicId,
            fields.intervention_kind,
            Number(source.revision),
            actor.accountId,
            receiptId,
          ],
        );
        if (order.rows.length !== 1) throw new Error("ORDER_RECEIPT_MISSING");
        return {
          kind: "result" as const,
          result: receipt(order.rows[0]!, false),
        };
      });
    },
  };
}
