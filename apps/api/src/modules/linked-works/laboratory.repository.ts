import { createHash, randomUUID } from "node:crypto";
import {
  LaboratoryLinkedWorkSchema,
  LaboratoryLinkedWorkResultSchema,
  LaboratoryClinicOrderSchema,
  LaboratoryClinicListSchema,
} from "@dental-lab/contracts";
import type {
  LaboratoryLinkedWork,
  LaboratoryClinicOrder,
} from "@dental-lab/contracts";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
import { appendClinicalMailIntent } from "../notifications/index.js";
import { readCatalogForUse } from "../catalog/index.js";
type Actor = { accountId: string; sessionId: string };
// Account before clinic, as in the account suspension workflow. Recheck their
// association once both locks are held.
async function lockEligibleClinic(tx: DatabaseExecutor, clinicId: string) {
  const target = await tx.query<{ account_id: string }>(
    "SELECT id,account_id FROM public.clinics WHERE id=$1",
    [clinicId],
  );
  if (!target.rows[0]) return { rows: [] };
  const accountId = target.rows[0].account_id;
  await tx.query("SELECT id FROM public.accounts WHERE id=$1 FOR SHARE", [
    accountId,
  ]);
  return tx.query<{ clinic_id: string }>(
    `SELECT c.id AS clinic_id FROM public.clinics c JOIN public.accounts a ON a.id=c.account_id
     WHERE c.id=$1 AND c.account_id=$2 AND c.review_state='approved' AND NOT c.suspended
       AND a.lifecycle='active' AND NOT a.security_locked AND NOT a.credential_reset_required
     FOR SHARE OF c`,
    [clinicId, accountId],
  );
}

// No retry here: a lost COMMIT response must be reconciled using the same receipt key.
export function createLaboratoryLinkedWorkRepository(
  database: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
  internalNotices = false,
) {
  async function submitCommand(
    actor: Actor,
    command: LaboratoryLinkedWork | LaboratoryClinicOrder,
  ) {
    const sourceCommand = "source_order_id" in command ? command : null;
    const intent = sourceCommand
      ? "laboratory_linked_work"
      : "laboratory_clinic_order";
    const { input, idempotency_key, confirmed_warnings } = command;
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          ...command,
          confirmed_warnings: undefined,
          idempotency_key: undefined,
          input: {
            ...input,
            teeth: [...input.teeth].sort((a, b) => a.fdi - b.fdi),
          },
        }),
      )
      .digest();
    return database.transaction(async (tx) => {
      // Account serialization covers receipt insertion across all sessions of this laboratory actor.
      await tx.query("SELECT id FROM public.accounts WHERE id=$1 FOR UPDATE", [
        actor.accountId,
      ]);
      await tx.query("LOCK TABLE public.account_grants IN SHARE MODE");
      await tx.query(
        "SELECT id FROM public.sessions WHERE id=$1 AND account_id=$2 FOR SHARE",
        [actor.sessionId, actor.accountId],
      );
      const identity =
        await createCurrentPermissionsRepository(tx).current(actor);
      if (
        !identity ||
        identity.profile === "clinic" ||
        !identity.permissions.includes("orders.create_for_clinic") ||
        (sourceCommand && !identity.permissions.includes("linked_works.manage"))
      )
        return { kind: "denied" as const };
      // A linked work derives its clinic from the source; a standalone work
      // must select an existing, currently approved clinic in this one-lab system.
      const scoped =
        "clinic_id" in command
          ? await lockEligibleClinic(tx, command.clinic_id)
          : await tx.query(
              "SELECT id,clinic_id FROM public.orders WHERE id=$1",
              [command.source_order_id],
            );
      if (scoped.rows.length !== 1) return { kind: "denied" as const };
      const clinicId = scoped.rows[0]!.clinic_id;
      const previous = await tx.query(
        "SELECT r.payload_fingerprint,o.id AS order_id,o.number::text,o.received_at FROM public.submission_receipts r JOIN public.orders o ON o.id=r.order_id AND o.clinic_id=r.clinic_id WHERE r.account_id=$1 AND r.intent=$2 AND r.idempotency_key=$3",
        [actor.accountId, intent, idempotency_key],
      );
      const receipt = (row: Record<string, unknown>, replayed: boolean) =>
        LaboratoryLinkedWorkResultSchema.parse({
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
            result: LaboratoryLinkedWorkResultSchema.parse({
              kind: "conflict",
              persisted: false,
            }),
          };
        return { kind: "result" as const, result: receipt(row, true) };
      }
      const { missing, references } = await readCatalogForUse(tx, input);
      // Match catalogue -> order lock ordering used by edit/acceptance.
      const sources = sourceCommand
        ? await tx.query(
            "SELECT id,clinic_id,status,current_version_id,revision::text FROM public.orders WHERE id=$1 AND clinic_id=$2 FOR UPDATE",
            [sourceCommand.source_order_id, clinicId],
          )
        : { rows: [] };
      const source = sources.rows[0];
      if (
        sourceCommand &&
        (!source ||
          !["manufacturing", "completed", "delivered"].includes(
            String(source.status),
          ) ||
          source.current_version_id !==
            sourceCommand.expected_source_version_id ||
          Number(source.revision) !== sourceCommand.expected_source_revision)
      )
        return {
          kind: "result" as const,
          result: LaboratoryLinkedWorkResultSchema.parse({
            kind: "source_unavailable",
            persisted: false,
          }),
        };
      const cancelSource =
        sourceCommand?.kind === "replacement" &&
        source?.status === "manufacturing";
      if (cancelSource && !identity.permissions.includes("orders.cancel"))
        return { kind: "denied" as const };

      const reasons: (
        "catalog_missing" | "catalog_forbidden" | "files_not_ready"
      )[] = [];
      // A deleted entry cannot be reconstructed from an untrusted browser label.
      if (missing || references.some((r) => !r.label?.trim()))
        reasons.push("catalog_missing");
      if (references.some((r) => r.state === "forbidden"))
        reasons.push("catalog_forbidden");
      if (input.file_ids.length) reasons.push("files_not_ready");
      if (reasons.length)
        return {
          kind: "result" as const,
          result: LaboratoryLinkedWorkResultSchema.parse({
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
      if (
        warnings.includes("catalog_unavailable") &&
        (!confirmed_warnings || !command.exception_reason)
      )
        return {
          kind: "result" as const,
          result: LaboratoryLinkedWorkResultSchema.parse({
            kind: "exception_required",
            persisted: false,
          }),
        };
      if (warnings.length && !confirmed_warnings)
        return {
          kind: "result" as const,
          result: LaboratoryLinkedWorkResultSchema.parse({
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
        "INSERT INTO public.orders(id,clinic_id,kind,origin,created_by,status,revision,current_version_id) VALUES($1,$2,'normal','laboratory',$3,'accepted',1,$4) RETURNING id AS order_id,number::text,received_at",
        [orderId, clinicId, actor.accountId, versionId],
      );
      await tx.query(
        "INSERT INTO public.order_versions(id,order_id,clinic_id,order_kind,order_origin,version_number,created_by,patient_first_name,patient_last_name,patient_reference,material_snapshot_id,shade_snapshot_id,work_type_snapshot_id,description,requested_delivery_date) VALUES($1,$2,$3,'normal','laboratory',1,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
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
      await tx.query(
        "INSERT INTO public.order_logistics(order_id,clinic_id) VALUES($1,$2)",
        [orderId, clinicId],
      );
      await tx.query(
        "INSERT INTO public.order_status_events(order_id,clinic_id,previous_status,next_status,actor_id,decided_version_id,aggregate_revision,reason) VALUES($1,$2,NULL,'accepted',$3,$4,1,$5)",
        [
          orderId,
          clinicId,
          actor.accountId,
          versionId,
          command.exception_reason ?? sourceCommand?.reason ?? null,
        ],
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
        "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,actor_id,correlation_id) VALUES($1,'laboratory_order_created','order',$2,1,$3,$4,$5)",
        [eventId, orderId, clinicId, actor.accountId, requestId],
      );
      await tx.query(
        "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
        [eventId],
      );
      await tx.query(
        "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,$2,'order',$3,$4,1,ARRAY['status','version'])",
        [
          actor.accountId,
          sourceCommand
            ? "LABORATORY_LINKED_WORK_CREATED"
            : "LABORATORY_ORDER_CREATED",
          orderId,
          requestId,
        ],
      );
      const receiptId = randomUUID();
      await tx.query(
        "INSERT INTO public.submission_receipts(id,account_id,intent,idempotency_key,payload_fingerprint,order_id,clinic_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          receiptId,
          actor.accountId,
          intent,
          idempotency_key,
          fingerprint,
          orderId,
          clinicId,
        ],
      );
      if (sourceCommand)
        await tx.query(
          "INSERT INTO public.work_links(source_order_id,child_order_id,clinic_id,kind,child_current_status,source_revision,source_status_at_creation,created_by,reason,idempotency_receipt_id) VALUES($1,$2,$3,$4,'accepted',$5,$6,$7,$8,$9)",
          [
            source!.id,
            orderId,
            clinicId,
            sourceCommand.kind,
            Number(source!.revision),
            source!.status,
            actor.accountId,
            sourceCommand.reason ?? null,
            receiptId,
          ],
        );
      if (!sourceCommand) {
        const notice = await tx.query(
          `INSERT INTO public.internal_notifications(event_id,target_account_id)
             SELECT $1,c.account_id FROM public.clinics c JOIN public.accounts a ON a.id=c.account_id
             WHERE c.id=$2 AND c.review_state='approved' AND NOT c.suspended AND a.lifecycle='active'
               AND NOT a.security_locked AND NOT a.credential_reset_required RETURNING id`,
          [eventId, clinicId],
        );
        if (notice.rows.length !== 1)
          throw new Error("CLINIC_NOTIFICATION_UNAVAILABLE");
        if ((await appendClinicalMailIntent(tx, eventId)) !== "prepared")
          throw new Error("CLINIC_MAIL_INTENT_UNAVAILABLE");
      }
      if (cancelSource && sourceCommand && source) {
        const revision = Number(source.revision) + 1,
          cancellationEvent = randomUUID();
        const updated = await tx.query(
          "UPDATE public.orders SET status='cancelled',revision=revision+1 WHERE id=$1 AND revision=$2 AND status='manufacturing' RETURNING id",
          [source.id, sourceCommand.expected_source_revision],
        );
        if (updated.rows.length !== 1)
          throw new Error("LINKED_SOURCE_WRITE_CONFLICT");
        const closed = await tx.query(
          "UPDATE public.order_requests SET state='closed',decided_by=$2,decided_at=clock_timestamp(),decision_reason=$3,close_cause='order_cancelled',revision=revision+1 WHERE order_id=$1 AND state='pending' RETURNING id",
          [source.id, actor.accountId, sourceCommand.reason],
        );
        if (closed.rows.length)
          await tx.query(
            "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,'ORDER_REQUESTS_CLOSED','order',$2,$3,$4,ARRAY['status'])",
            [actor.accountId, source.id, requestId, revision],
          );
        await tx.query(
          "INSERT INTO public.order_status_events(order_id,clinic_id,previous_status,next_status,actor_id,reason,decided_version_id,aggregate_revision) VALUES($1,$2,'manufacturing','cancelled',$3,$4,$5,$6)",
          [
            source.id,
            clinicId,
            actor.accountId,
            sourceCommand.reason,
            source.current_version_id,
            revision,
          ],
        );
        await tx.query(
          "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,actor_id,correlation_id) VALUES($1,'order_cancelled','order',$2,$3,$4,$5,$6)",
          [
            cancellationEvent,
            source.id,
            revision,
            clinicId,
            actor.accountId,
            requestId,
          ],
        );
        await tx.query(
          "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
          [cancellationEvent],
        );
        await tx.query(
          "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,'ORDER_REPLACED','order',$2,$3,$4,ARRAY['status'])",
          [actor.accountId, source.id, requestId, revision],
        );
      }
      if (order.rows.length !== 1) throw new Error("ORDER_RECEIPT_MISSING");
      return {
        kind: "result" as const,
        result: receipt(order.rows[0]!, false),
      };
    });
  }
  return {
    async submit(actor: Actor, raw: unknown) {
      const parsed = LaboratoryLinkedWorkSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return submitCommand(actor, parsed.data);
    },
    async submitStandalone(actor: Actor, raw: unknown) {
      if (!internalNotices) return { kind: "denied" as const };
      const parsed = LaboratoryClinicOrderSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return submitCommand(actor, parsed.data);
    },
    async clinics(actor: Actor, after?: string) {
      return database.transaction(async (tx) => {
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
        if (
          !identity ||
          identity.profile === "clinic" ||
          !identity.permissions.includes("orders.create_for_clinic")
        )
          return null;
        const rows = await tx.query<{ id: string; name: string }>(
          `SELECT c.id,c.name FROM public.clinics c JOIN public.accounts a ON a.id=c.account_id
           WHERE c.review_state='approved' AND NOT c.suspended AND a.lifecycle='active'
             AND NOT a.security_locked AND NOT a.credential_reset_required
             AND ($1::uuid IS NULL OR c.id>$1) ORDER BY c.id LIMIT 51`,
          [after ?? null],
        );
        return LaboratoryClinicListSchema.parse({
          items: rows.rows.slice(0, 50),
          next_after: rows.rows.length > 50 ? rows.rows[49]!.id : null,
        });
      });
    },
  };
}
