import { randomUUID } from "node:crypto";
import {
  OrderEditSchema,
  OrderModificationProposalSchema,
  OrderEditQuerySchema,
  OrderEditViewSchema,
  OrderInstructionsSchema,
  OrderEditResultSchema,
} from "@dental-lab/contracts";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { readCatalogForUse } from "../catalog/index.js";
import { editAuthority } from "./edit-auth.js";
import { readEditVersion, editableInput } from "./edit-version.js";
type Actor = { accountId: string; sessionId: string };
export function createOrderEditRepository(
  db: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async context(actor: Actor, raw: unknown) {
      const parsed = OrderEditQuerySchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      const input = parsed.data;
      return db.transaction(async (tx) => {
        const auth = await editAuthority(tx, actor);
        if (!auth) return { kind: "denied" as const };
        const r = await tx.query(
          "SELECT id,number::text,status,kind,origin,current_version_id,revision::text FROM public.orders WHERE id=$1 AND ($2::uuid IS NULL OR clinic_id=$2) FOR SHARE",
          [input.order_id, auth.clinicId],
        );
        const order = r.rows[0];
        if (!order) return { kind: "denied" as const };
        const version = await readEditVersion(
          tx,
          order.id,
          input.version_id ?? order.current_version_id,
        );
        if (!version) return { kind: "denied" as const };
        const history = await tx.query(
          "SELECT id,version_number::text,created_at,created_by,reason FROM public.order_versions WHERE order_id=$1 AND ($2::bigint IS NULL OR version_number<$2) ORDER BY version_number DESC LIMIT 21",
          [order.id, input.before_version ?? null],
        );
        return {
          kind: "result" as const,
          result: OrderEditViewSchema.parse({
            order_id: order.id,
            number: order.number,
            status: order.status,
            kind: order.kind,
            origin: order.origin,
            revision: Number(order.revision),
            current_version_id: order.current_version_id,
            version_id: version.id,
            input: editableInput(version),
            file_count: version.file_count,
            labels: {
              material: version.material,
              shade: version.shade,
              work_type: version.work_type,
            },
            history: history.rows.slice(0, 20).map((v) => ({
              ...v,
              version_number: Number(v.version_number),
              created_at:
                v.created_at instanceof Date
                  ? v.created_at.toISOString()
                  : v.created_at,
            })),
            next_before_version:
              history.rows.length > 20
                ? Number(history.rows[19]!.version_number)
                : null,
          }),
        };
      });
    },
    async decide(actor: Actor, raw: unknown, proposal = false) {
      const parsed = (
        proposal ? OrderModificationProposalSchema : OrderEditSchema
      ).safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      const command = parsed.data;
      const result = (r: unknown) => ({
        kind: "result" as const,
        result: OrderEditResultSchema.parse(r),
      });
      return db.transaction(async (tx) => {
        const auth = await editAuthority(tx, actor);
        if (!auth || (!auth.clinic && command.action !== "save"))
          return { kind: "denied" as const };
        if (!auth.clinic && command.action === "save" && !command.reason)
          return { kind: "invalid" as const };
        // Scope before reading patient data or taking catalogue locks. Recheck the aggregate after locks.
        const initial = await tx.query(
          "SELECT id,current_version_id FROM public.orders WHERE id=$1 AND ($2::uuid IS NULL OR clinic_id=$2)",
          [command.order_id, auth.clinicId],
        );
        if (!initial.rows[0]) return { kind: "denied" as const };
        if (initial.rows[0]!.current_version_id !== command.expected_version_id)
          return result({ kind: "conflict" });
        const previous = await readEditVersion(
          tx,
          command.order_id,
          command.expected_version_id,
        );
        if (!previous) throw new Error("ORDER_EDIT_VERSION_MISSING");
        const input =
          command.action !== "resubmit_correction"
            ? command.input
            : OrderInstructionsSchema.safeParse(editableInput(previous));
        const instructions =
          command.action !== "resubmit_correction"
            ? command.input
            : "success" in input && input.success
              ? input.data
              : null;
        if (!instructions)
          return result({ kind: "blocked", reason: "catalog_missing" });
        const catalog = await readCatalogForUse(tx, instructions);
        const locked = await tx.query(
          "SELECT id,clinic_id,status,kind,origin,current_version_id,manufacturing_version_id,revision::text FROM public.orders WHERE id=$1 AND ($2::uuid IS NULL OR clinic_id=$2) FOR UPDATE",
          [command.order_id, auth.clinicId],
        );
        const order = locked.rows[0];
        if (
          !order ||
          order.current_version_id !== command.expected_version_id ||
          Number(order.revision) !== command.expected_revision
        )
          return result({ kind: "conflict" });
        const allowed =
          command.action === "resubmit_correction"
            ? order.status === "correction_requested"
            : auth.clinic
              ? command.action === "propose_modification"
                ? order.status === "accepted"
                : ["pending", "correction_requested"].includes(order.status)
              : order.status === "accepted";
        if (!allowed || order.manufacturing_version_id !== null)
          return result({ kind: "conflict" });
        if (
          order.kind === "retouch" &&
          (instructions.teeth.length || !instructions.description?.trim())
        )
          return { kind: "invalid" as const };
        if (
          order.kind === "normal" &&
          order.origin === "clinic" &&
          !instructions.requested_delivery_date
        )
          return { kind: "invalid" as const };
        if (previous.file_count !== 0 || instructions.file_ids.length)
          return result({ kind: "blocked", reason: "files_not_ready" });
        if (
          (
            await tx.query(
              "SELECT id FROM public.order_requests WHERE order_id=$1 AND state='pending' LIMIT 1",
              [order.id],
            )
          ).rows.length
        )
          return result({ kind: "blocked", reason: "pending_request" });
        if (catalog.missing || catalog.references.some((r) => !r.label?.trim()))
          return result({ kind: "blocked", reason: "catalog_missing" });
        if (catalog.references.some((r) => r.state === "forbidden"))
          return result({ kind: "blocked", reason: "catalog_forbidden" });
        if (
          command.action === "resubmit_correction" &&
          (
            await tx.query(
              "SELECT id FROM public.order_security_blocks WHERE order_id=$1 AND cleared_at IS NULL LIMIT 1",
              [order.id],
            )
          ).rows.length
        )
          return result({ kind: "blocked", reason: "security_block" });
        if (
          (catalog.references.some((r) => r.state === "unavailable") ||
            (!instructions.teeth.length &&
              !instructions.description?.trim())) &&
          !command.confirmed_warnings
        )
          return result({ kind: "confirmation_required" });
        let versionId = order.current_version_id;
        const revision = Number(order.revision) + 1,
          correlation = randomUUID(),
          eventId = randomUUID();
        if (command.action !== "resubmit_correction") {
          const snapshots = new Map<string, string>();
          for (const ref of catalog.references) {
            const oldRef = previous[ref.kind + "_id"],
              oldSnapshot = previous[ref.kind + "_snapshot_id"];
            if (oldRef === ref.id && typeof oldSnapshot === "string")
              snapshots.set(ref.kind, oldSnapshot);
            else {
              const snapshot = randomUUID();
              snapshots.set(ref.kind, snapshot);
              await tx.query(
                "INSERT INTO public.catalog_reference_snapshots(id,reference_id,kind,label,source_revision) VALUES($1,$2,$3,$4,$5)",
                [snapshot, ref.id, ref.kind, ref.label, ref.revision],
              );
            }
          }
          versionId = randomUUID();
          const sequence = await tx.query(
            "SELECT COALESCE(max(version_number),0)::text AS latest FROM public.order_versions WHERE order_id=$1",
            [order.id],
          );
          const next = Number(sequence.rows[0]?.latest) + 1;
          if (!Number.isSafeInteger(next) || next < 1)
            throw new Error("ORDER_VERSION_SEQUENCE_INVALID");
          await tx.query(
            "INSERT INTO public.order_versions(id,order_id,clinic_id,order_kind,order_origin,version_number,created_by,reason,patient_first_name,patient_last_name,patient_reference,material_snapshot_id,shade_snapshot_id,work_type_snapshot_id,description,requested_delivery_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)",
            [
              versionId,
              order.id,
              order.clinic_id,
              order.kind,
              order.origin,
              next,
              actor.accountId,
              "reason" in command ? (command.reason ?? null) : null,
              instructions.patient.first_name ?? null,
              instructions.patient.last_name ?? null,
              instructions.patient.internal_reference ?? null,
              snapshots.get("material"),
              snapshots.get("shade"),
              snapshots.get("work_type") ?? null,
              instructions.description ?? null,
              instructions.requested_delivery_date,
            ],
          );
          for (const tooth of instructions.teeth)
            await tx.query(
              "INSERT INTO public.order_version_teeth(version_id,order_id,clinic_id,fdi,selection) VALUES($1,$2,$3,$4,$5)",
              [
                versionId,
                order.id,
                order.clinic_id,
                tooth.fdi,
                tooth.selection,
              ],
            );
        }
        if (command.action === "propose_modification") {
          await tx.query(
            "INSERT INTO public.order_requests(id,order_id,clinic_id,kind,base_version_id,proposed_version_id,requested_by) VALUES($1,$2,$3,'modification',$4,$5,$6)",
            [
              randomUUID(),
              order.id,
              order.clinic_id,
              order.current_version_id,
              versionId,
              actor.accountId,
            ],
          );
          // The proposed version is immutable but never official before a laboratory decision.
          versionId = order.current_version_id;
        }
        const status =
          command.action === "resubmit_correction" ? "pending" : order.status;
        if (
          (
            await tx.query(
              "UPDATE public.orders SET current_version_id=$2,status=$3,revision=revision+1 WHERE id=$1 AND revision=$4 RETURNING id",
              [order.id, versionId, status, command.expected_revision],
            )
          ).rows.length !== 1
        )
          throw new Error("ORDER_EDIT_WRITE_CONFLICT");
        if (command.action === "resubmit_correction")
          await tx.query(
            "INSERT INTO public.order_status_events(order_id,clinic_id,previous_status,next_status,actor_id,decided_version_id,aggregate_revision) VALUES($1,$2,'correction_requested','pending',$3,$4,$5)",
            [order.id, order.clinic_id, actor.accountId, versionId, revision],
          );
        const event =
          command.action === "save"
            ? "instructions_changed"
            : command.action === "propose_modification"
              ? "modification_requested"
              : "correction_resubmitted";
        await tx.query(
          "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,actor_id,correlation_id) VALUES($1,$2,'order',$3,$4,$5,$6,$7)",
          [
            eventId,
            event,
            order.id,
            revision,
            order.clinic_id,
            actor.accountId,
            correlation,
          ],
        );
        await tx.query(
          "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
          [eventId],
        );
        await tx.query(
          "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,$2,'order',$3,$4,$5,$6::text[])",
          [
            actor.accountId,
            event.toUpperCase(),
            order.id,
            correlation,
            revision,
            [
              command.action === "save"
                ? "version"
                : command.action === "propose_modification"
                  ? "request"
                  : "status",
            ],
          ],
        );
        return result({
          kind: "updated",
          order_id: order.id,
          version_id: versionId,
          revision,
          status,
        });
      });
    },
  };
}
export async function assertOrderEditReady(db: DatabaseExecutor) {
  const r = await db.query(
    "SELECT has_table_privilege(current_user,'public.order_versions','INSERT') AND has_table_privilege(current_user,'public.order_version_teeth','INSERT') AND has_column_privilege(current_user,'public.orders','current_version_id','UPDATE') AS ready",
  );
  if (r.rows[0]?.ready !== true)
    throw new Error("ORDER_EDIT_STORAGE_NOT_READY");
}
