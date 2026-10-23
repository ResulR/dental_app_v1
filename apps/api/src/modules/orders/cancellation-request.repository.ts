import { randomUUID } from "node:crypto";
import {
  OrderCancellationRequestSchema,
  OrderLifecycleContextQuerySchema,
  OrderRequestContextSchema,
  OrderRequestResultSchema,
} from "@dental-lab/contracts";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
import { trackingAuthority } from "./tracking-auth.js";
type Actor = { accountId: string; sessionId: string };
export function createCancellationRequestRepository(
  db: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
  internalNotices = false,
) {
  return {
    async context(actor: Actor, raw: unknown) {
      const parsed = OrderLifecycleContextQuerySchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return db.transaction(async (tx) => {
        const auth = await trackingAuthority(tx, actor);
        if (!auth) return { kind: "denied" as const };
        const rows = await tx.query(
          "SELECT id AS order_id,number::text,status,current_version_id AS version_id,revision::text FROM public.orders WHERE id=$1 AND ($2::uuid IS NULL OR clinic_id=$2) FOR SHARE",
          [parsed.data.order_id, auth.clinicId],
        );
        const order = rows.rows[0];
        if (!order) return { kind: "denied" as const };
        const requests = await tx.query(
          "SELECT id,kind,revision::text FROM public.order_requests WHERE order_id=$1 AND state='pending'",
          [order.order_id],
        );
        if (requests.rows.length > 1)
          throw new Error("PENDING_REQUEST_INVARIANT");
        const pending = requests.rows[0];
        return {
          kind: "result" as const,
          result: OrderRequestContextSchema.parse({
            order: { ...order, revision: Number(order.revision) },
            pending: pending
              ? { ...pending, revision: Number(pending.revision) }
              : null,
          }),
        };
      });
    },
    async decide(actor: Actor, raw: unknown) {
      const parsed = OrderCancellationRequestSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      const input = parsed.data;
      const result = (value: unknown) => ({
        kind: "result" as const,
        result: OrderRequestResultSchema.parse(value),
      });
      try {
        return await db.transaction(async (tx) => {
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
          if (!identity) return { kind: "denied" as const };
          const clinical =
            input.action === "request_cancellation" ||
            input.action === "withdraw";
          let clinicId: string | null = null;
          if (clinical) {
            if (identity.profile !== "clinic")
              return { kind: "denied" as const };
            const clinics = await tx.query(
              "SELECT id FROM public.clinics WHERE account_id=$1 AND review_state='approved' AND NOT suspended",
              [actor.accountId],
            );
            if (clinics.rows.length !== 1) return { kind: "denied" as const };
            clinicId = clinics.rows[0]!.id;
          } else if (
            identity.profile === "clinic" ||
            !identity.permissions.includes("orders.cancel")
          )
            return { kind: "denied" as const };
          const locked = await tx.query(
            "SELECT id,clinic_id,status,current_version_id,revision::text FROM public.orders WHERE id=$1 AND ($2::uuid IS NULL OR clinic_id=$2) FOR UPDATE",
            [input.order_id, clinicId],
          );
          const order = locked.rows[0];
          if (!order) return { kind: "denied" as const };
          if (
            order.status !== "accepted" ||
            order.current_version_id !== input.expected_version_id ||
            Number(order.revision) !== input.expected_revision
          )
            return result({ kind: "conflict" });
          const pending = await tx.query(
            "SELECT id,kind,base_version_id,revision::text FROM public.order_requests WHERE order_id=$1 AND state='pending' FOR UPDATE",
            [order.id],
          );
          if (pending.rows.length > 1)
            throw new Error("PENDING_REQUEST_INVARIANT");
          const previous = pending.rows[0];
          if (input.action === "request_cancellation" && previous)
            return result({ kind: "pending_request" });
          if (
            input.action !== "request_cancellation" &&
            (!previous ||
              previous.id !== input.request_id ||
              Number(previous.revision) !== input.expected_request_revision ||
              previous.base_version_id !== order.current_version_id ||
              (input.action !== "withdraw" && previous.kind !== "cancellation"))
          )
            return result({ kind: "conflict" });
          const requestId = previous?.id ?? randomUUID(),
            revision = Number(order.revision) + 1,
            correlation = randomUUID(),
            eventId = randomUUID();
          const state =
            input.action === "request_cancellation"
              ? "pending"
              : input.action === "withdraw"
                ? "withdrawn"
                : input.action === "accept_cancellation"
                  ? "accepted"
                  : "rejected";
          const event =
            input.action === "request_cancellation"
              ? "cancellation_requested"
              : input.action === "withdraw"
                ? "request_withdrawn"
                : "request_decided";
          const reason = "reason" in input ? input.reason : null;
          if (input.action === "request_cancellation")
            await tx.query(
              "INSERT INTO public.order_requests(id,order_id,clinic_id,kind,base_version_id,requested_by) VALUES($1,$2,$3,'cancellation',$4,$5)",
              [
                requestId,
                order.id,
                order.clinic_id,
                order.current_version_id,
                actor.accountId,
              ],
            );
          else if (
            (
              await tx.query(
                "UPDATE public.order_requests SET state=$2,decided_by=$3,decided_at=clock_timestamp(),decision_reason=$4,revision=revision+1 WHERE id=$1 AND state='pending' AND revision=$5 RETURNING id",
                [
                  requestId,
                  state,
                  actor.accountId,
                  reason,
                  input.expected_request_revision,
                ],
              )
            ).rows.length !== 1
          )
            throw new Error("ORDER_REQUEST_WRITE_CONFLICT");
          const status =
            input.action === "accept_cancellation" ? "cancelled" : "accepted";
          if (
            (
              await tx.query(
                "UPDATE public.orders SET status=$2,revision=revision+1 WHERE id=$1 AND revision=$3 RETURNING id",
                [order.id, status, input.expected_revision],
              )
            ).rows.length !== 1
          )
            throw new Error("ORDER_REQUEST_AGGREGATE_CONFLICT");
          if (input.action === "accept_cancellation")
            await tx.query(
              "INSERT INTO public.order_status_events(order_id,clinic_id,previous_status,next_status,actor_id,reason,decided_version_id,aggregate_revision) VALUES($1,$2,'accepted','cancelled',$3,$4,$5,$6)",
              [
                order.id,
                order.clinic_id,
                actor.accountId,
                reason,
                order.current_version_id,
                revision,
              ],
            );
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
          if (internalNotices && event === "cancellation_requested") {
            const notice = await tx.query(
              "INSERT INTO public.internal_notifications(event_id,target_account_id) SELECT $1,a.id FROM public.owner_slot s JOIN public.accounts a ON a.id=s.account_id WHERE s.singleton=1 AND a.profile='owner' AND a.lifecycle='active' AND NOT a.security_locked AND NOT a.credential_reset_required RETURNING id",
              [eventId],
            );
            if (notice.rows.length !== 1)
              throw new Error("ORDER_OWNER_NOTIFICATION_UNAVAILABLE");
          }
          await tx.query(
            "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,$2,'order',$3,$4,$5,ARRAY['status'])",
            [
              actor.accountId,
              event.toUpperCase(),
              order.id,
              correlation,
              revision,
            ],
          );
          return result({
            kind: "updated",
            order_id: order.id,
            revision,
            request_id: requestId,
            state,
          });
        });
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23505" &&
          "constraint" in error &&
          error.constraint === "order_requests_one_pending_idx"
        )
          return result({ kind: "pending_request" });
        throw error;
      }
    },
  };
}
export async function assertCancellationRequestReady(db: DatabaseExecutor) {
  const r = await db.query(
    "SELECT has_table_privilege(current_user,'public.order_requests','INSERT') AND has_column_privilege(current_user,'public.order_requests','decided_by','UPDATE') AND has_column_privilege(current_user,'public.order_requests','decision_reason','UPDATE') AND has_column_privilege(current_user,'public.order_requests','revision','UPDATE') AS ready",
  );
  if (r.rows[0]?.ready !== true)
    throw new Error("ORDER_REQUEST_STORAGE_NOT_READY");
}
