import { randomUUID } from "node:crypto";
import {
  OrderLifecycleSchema,
  OrderLifecycleResultSchema,
} from "@dental-lab/contracts";
import type { OrderLifecycleResult } from "@dental-lab/contracts";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
type Actor = { accountId: string; sessionId: string };
type Outcome =
  | { kind: "invalid" }
  | { kind: "denied" }
  | { kind: "result"; result: OrderLifecycleResult };
const permissions = {
  complete: "orders.change_status",
  deliver: "delivery.mark_delivered",
  correct_delivery: "delivery.correct",
  request_correction: "orders.request_correction",
  cancel: "orders.cancel",
} as const;
const targets = {
  complete: "completed",
  deliver: "delivered",
  correct_delivery: "completed",
  request_correction: "correction_requested",
  cancel: "cancelled",
} as const;
const events = {
  complete: "order_completed",
  deliver: "order_delivered",
  correct_delivery: "delivery_corrected",
  request_correction: "correction_requested",
  cancel: "order_cancelled",
} as const;
export function createOrderLifecycleRepository(
  database: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
  internalNotices = false,
) {
  return {
    async decide(actor: Actor, raw: unknown): Promise<Outcome> {
      const parsed = OrderLifecycleSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" };
      const input = parsed.data;
      const result = (value: OrderLifecycleResult): Outcome => ({
        kind: "result",
        result: OrderLifecycleResultSchema.parse(value),
      });
      try {
        return await database.transaction(async (tx) => {
          await tx.query(
            "SELECT id FROM public.accounts WHERE id=$1 FOR SHARE",
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
          if (!identity) return { kind: "denied" };
          let clinicId: string | null = null;
          if (identity.profile === "clinic") {
            if (input.action !== "cancel") return { kind: "denied" };
            const clinic = await tx.query(
              "SELECT id FROM public.clinics WHERE account_id=$1 AND review_state='approved' AND NOT suspended",
              [actor.accountId],
            );
            if (clinic.rows.length !== 1) return { kind: "denied" };
            clinicId = clinic.rows[0]!.id;
          } else if (!identity.permissions.includes(permissions[input.action]))
            return { kind: "denied" };
          if (
            input.action === "cancel" &&
            identity.profile !== "clinic" &&
            !input.reason
          )
            return { kind: "invalid" };
          // Catalogue locks precede the aggregate lock, as in initial decisions/catalogue restrictions.
          const progress =
            input.action === "complete" || input.action === "deliver";
          let references: string[] = [];
          if (progress) {
            const initial = await tx.query(
              "SELECT o.current_version_id,v.material_snapshot_id,v.shade_snapshot_id,v.work_type_snapshot_id FROM public.orders o JOIN public.order_versions v ON v.id=o.current_version_id AND v.order_id=o.id WHERE o.id=$1",
              [input.order_id],
            );
            const version = initial.rows[0];
            if (
              !version ||
              version.current_version_id !== input.expected_version_id
            )
              return result({ kind: "conflict" });
            const snapshots = [
              version.material_snapshot_id,
              version.shade_snapshot_id,
              ...(version.work_type_snapshot_id
                ? [version.work_type_snapshot_id]
                : []),
            ];
            const refs = await tx.query(
              "SELECT id,reference_id FROM public.catalog_reference_snapshots WHERE id=ANY($1::uuid[]) ORDER BY id",
              [snapshots],
            );
            references = [
              ...new Set(
                refs.rows
                  .map((r) => r.reference_id)
                  .filter((id): id is string => typeof id === "string"),
              ),
            ].sort();
            if (
              references.length !== snapshots.length ||
              refs.rows.length !== snapshots.length
            )
              return result({ kind: "blocked", reason: "catalog_missing" });
            await tx.query(
              "SELECT id FROM public.catalog_references WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE",
              [references],
            );
          }
          const locked = await tx.query(
            "SELECT id,clinic_id,status,current_version_id,manufacturing_version_id,revision::text FROM public.orders WHERE id=$1 AND ($2::uuid IS NULL OR clinic_id=$2) FOR UPDATE",
            [input.order_id, clinicId],
          );
          const order = locked.rows[0];
          if (!order) return { kind: "denied" };
          if (
            order.current_version_id !== input.expected_version_id ||
            Number(order.revision) !== input.expected_revision
          )
            return result({ kind: "conflict" });
          const allowed =
            input.action === "complete"
              ? order.status === "manufacturing"
              : input.action === "deliver"
                ? order.status === "completed"
                : input.action === "correct_delivery"
                  ? order.status === "delivered"
                  : input.action === "request_correction"
                    ? order.status === "pending"
                    : (identity.profile === "clinic"
                        ? ["pending", "correction_requested"]
                        : [
                            "pending",
                            "correction_requested",
                            "accepted",
                            "manufacturing",
                          ]
                      ).includes(order.status);
          if (!allowed) return result({ kind: "conflict" });
          if (progress) {
            if (order.manufacturing_version_id !== order.current_version_id)
              throw new Error("MANUFACTURING_VERSION_INCONSISTENT");
            const states = await tx.query(
              "SELECT id,effective_use_state AS state FROM public.catalog_effective_states WHERE id=ANY($1::uuid[]) ORDER BY id",
              [references],
            );
            if (
              states.rows.length !== references.length ||
              states.rows.some(
                (r) =>
                  !["available", "unavailable", "forbidden"].includes(r.state),
              )
            )
              return result({ kind: "blocked", reason: "catalog_missing" });
            if (states.rows.some((r) => r.state === "forbidden"))
              return result({ kind: "blocked", reason: "catalog_forbidden" });
            if (
              (
                await tx.query(
                  "SELECT id FROM public.order_security_blocks WHERE order_id=$1 AND cleared_at IS NULL LIMIT 1",
                  [order.id],
                )
              ).rows.length
            )
              return result({ kind: "blocked", reason: "security_block" });
            if (
              (
                await tx.query(
                  "SELECT file_id FROM public.order_version_files WHERE version_id=$1 LIMIT 1",
                  [order.current_version_id],
                )
              ).rows.length
            )
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
          }
          if (
            input.action === "correct_delivery" &&
            (
              await tx.query(
                "SELECT id FROM public.work_links WHERE source_order_id=$1 AND kind='retouch' LIMIT 1",
                [order.id],
              )
            ).rows.length
          )
            return result({ kind: "blocked", reason: "linked_retouch" });
          const revision = Number(order.revision) + 1,
            status = targets[input.action],
            correlation = randomUUID(),
            event = randomUUID();
          const reason =
            "reason" in input
              ? (input.reason ??
                (identity.profile === "clinic"
                  ? "CLINIC_CANCELLATION_CONFIRMED"
                  : null))
              : null;
          if (
            (
              await tx.query(
                "UPDATE public.orders SET status=$2,revision=revision+1 WHERE id=$1 AND revision=$3 RETURNING id",
                [order.id, status, input.expected_revision],
              )
            ).rows.length !== 1
          )
            throw new Error("ORDER_LIFECYCLE_WRITE_CONFLICT");
          if (input.action === "cancel") {
            // Retain every request and its proposal; record why it can no longer be decided.
            const closed = await tx.query(
              "UPDATE public.order_requests SET state='closed',decided_by=$2,decided_at=clock_timestamp(),decision_reason=$3,close_cause='order_cancelled',revision=revision+1 WHERE order_id=$1 AND state='pending' RETURNING id",
              [order.id, actor.accountId, reason],
            );
            if (closed.rows.length)
              await tx.query(
                "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,'ORDER_REQUESTS_CLOSED','order',$2,$3,$4,ARRAY['status'])",
                [actor.accountId, order.id, correlation, revision],
              );
          }
          if (
            input.action === "deliver" ||
            input.action === "correct_delivery"
          ) {
            const before = await tx.query(
              "SELECT to_jsonb(l) AS values FROM public.order_logistics l WHERE order_id=$1 FOR UPDATE",
              [order.id],
            );
            if (before.rows.length !== 1)
              throw new Error("ORDER_LOGISTICS_MISSING");
            const after =
              input.action === "deliver"
                ? await tx.query(
                    "WITH stamp AS (SELECT clock_timestamp() AS at) UPDATE public.order_logistics l SET delivery_mode=$2,delivered_at=stamp.at,delivered_by=$3,archive_due_at=stamp.at+interval '30 days',revision=l.revision+1 FROM stamp WHERE order_id=$1 RETURNING to_jsonb(l) AS values",
                    [order.id, input.mode, actor.accountId],
                  )
                : await tx.query(
                    "UPDATE public.order_logistics l SET delivery_mode=NULL,delivered_at=NULL,delivered_by=NULL,archive_due_at=NULL,revision=revision+1 WHERE order_id=$1 RETURNING to_jsonb(l) AS values",
                    [order.id],
                  );
            if (after.rows.length !== 1)
              throw new Error("ORDER_LOGISTICS_WRITE_CONFLICT");
            await tx.query(
              "INSERT INTO public.order_logistics_events(order_id,clinic_id,actor_id,before_values,after_values,reason) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6)",
              [
                order.id,
                order.clinic_id,
                actor.accountId,
                JSON.stringify(before.rows[0]!.values),
                JSON.stringify(after.rows[0]!.values),
                reason,
              ],
            );
            if (
              (
                await tx.query(
                  "UPDATE public.conversations SET closed_at=CASE WHEN $2::boolean THEN clock_timestamp() ELSE NULL END,revision=revision+1 WHERE order_id=$1 AND kind='order' RETURNING id",
                  [order.id, input.action === "deliver"],
                )
              ).rows.length !== 1
            )
              throw new Error("ORDER_CONVERSATION_MISSING");
          }
          await tx.query(
            "INSERT INTO public.order_status_events(order_id,clinic_id,previous_status,next_status,actor_id,reason,decided_version_id,aggregate_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
            [
              order.id,
              order.clinic_id,
              order.status,
              status,
              actor.accountId,
              reason,
              order.current_version_id,
              revision,
            ],
          );
          await tx.query(
            "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,actor_id,correlation_id) VALUES($1,$2,'order',$3,$4,$5,$6,$7)",
            [
              event,
              events[input.action],
              order.id,
              revision,
              order.clinic_id,
              actor.accountId,
              correlation,
            ],
          );
          await tx.query(
            "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
            [event],
          );
          if (internalNotices && input.action === "request_correction") {
            const notice = await tx.query(
              `INSERT INTO public.internal_notifications(event_id,target_account_id)
               SELECT $1,a.id FROM public.clinics c JOIN public.accounts a ON a.id=c.account_id
               WHERE c.id=$2 AND c.review_state='approved' AND NOT c.suspended
                 AND a.profile='clinic' AND a.lifecycle='active'
                 AND NOT a.security_locked AND NOT a.credential_reset_required
               RETURNING id`,
              [event, order.clinic_id],
            );
            if (notice.rows.length !== 1)
              throw new Error("CORRECTION_CLINIC_NOTIFICATION_UNAVAILABLE");
          }
          await tx.query(
            "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,$2,'order',$3,$4,$5,ARRAY['status'])",
            [
              actor.accountId,
              events[input.action].toUpperCase(),
              order.id,
              correlation,
              revision,
            ],
          );
          return result({
            kind: "updated",
            order_id: order.id,
            status,
            revision,
            version_id: order.current_version_id,
          });
        });
      } catch (error) {
        // A delivered retouch becoming active can collide with a later active sibling. Never bypass the index.
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23505" &&
          "constraint" in error &&
          error.constraint === "work_links_one_active_retouch_idx"
        )
          return result({ kind: "blocked", reason: "active_retouch" });
        throw error;
      }
    },
  };
}
export async function assertOrderLifecycleReady(database: DatabaseExecutor) {
  const r = await database.query(
    "SELECT has_column_privilege(current_user,'public.order_logistics','delivered_at','UPDATE') AND has_column_privilege(current_user,'public.order_logistics','archive_due_at','UPDATE') AND has_column_privilege(current_user,'public.conversations','closed_at','UPDATE') AND has_table_privilege(current_user,'public.order_logistics_events','INSERT') AND has_column_privilege(current_user,'public.order_requests','state','UPDATE') AND has_table_privilege(current_user,'public.work_links','SELECT') AS ready",
  );
  if (r.rows[0]?.ready !== true)
    throw new Error("ORDER_LIFECYCLE_STORAGE_NOT_READY");
}
