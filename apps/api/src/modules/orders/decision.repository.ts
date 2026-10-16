import { randomUUID } from "node:crypto";
import {
  OrderDecisionSchema,
  OrderDecisionResultSchema,
} from "@dental-lab/contracts";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
type Actor = { accountId: string; sessionId: string };
const permissions = {
  accept: "orders.accept",
  reject: "orders.reject",
  start_manufacturing: "orders.start_manufacturing",
} as const;
const statuses = {
  accept: "accepted",
  reject: "rejected",
  start_manufacturing: "manufacturing",
} as const;
const events = {
  accept: "order_accepted",
  reject: "order_rejected",
  start_manufacturing: "manufacturing_started",
} as const;
export function createOrderDecisionRepository(
  database: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async decide(actor: Actor, raw: unknown) {
      const parsed = OrderDecisionSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      const input = parsed.data;
      return database.transaction(async (tx) => {
        const result = (value: unknown) => ({
          kind: "result" as const,
          result: OrderDecisionResultSchema.parse(value),
        });
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
          !identity.permissions.includes(permissions[input.action])
        )
          return { kind: "denied" as const };
        // Discover only immutable snapshot identities; recheck version after acquiring the order lock.
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
        const snapshotIds = [
          version.material_snapshot_id,
          version.shade_snapshot_id,
          ...(version.work_type_snapshot_id
            ? [version.work_type_snapshot_id]
            : []),
        ];
        const snapshots = await tx.query(
          "SELECT id,reference_id FROM public.catalog_reference_snapshots WHERE id=ANY($1::uuid[]) ORDER BY id",
          [snapshotIds],
        );
        const ids = [
          ...new Set(
            snapshots.rows
              .map((r) => r.reference_id)
              .filter((id): id is string => typeof id === "string"),
          ),
        ].sort();
        await tx.query(
          "SELECT id FROM public.catalog_references WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE",
          [ids],
        );
        const locked = await tx.query(
          "SELECT id,clinic_id,status,current_version_id,revision::text FROM public.orders WHERE id=$1 FOR UPDATE",
          [input.order_id],
        );
        const order = locked.rows[0];
        if (
          !order ||
          order.current_version_id !== input.expected_version_id ||
          Number(order.revision) !== input.expected_revision ||
          order.status !==
            (input.action === "start_manufacturing" ? "accepted" : "pending")
        )
          return result({ kind: "conflict" });
        if (input.action !== "reject") {
          if (
            snapshots.rows.length !== snapshotIds.length ||
            ids.length !== snapshotIds.length
          )
            return result({ kind: "blocked", reason: "catalog_missing" });
          const states = await tx.query(
            "SELECT id,effective_use_state AS state FROM public.catalog_effective_states WHERE id=ANY($1::uuid[]) ORDER BY id",
            [ids],
          );
          if (
            states.rows.length !== ids.length ||
            states.rows.some(
              (r) =>
                !["available", "unavailable", "forbidden"].includes(r.state),
            )
          )
            return result({ kind: "blocked", reason: "catalog_missing" });
          if (states.rows.some((r) => r.state === "forbidden"))
            return result({ kind: "blocked", reason: "catalog_forbidden" });
          const blocks = await tx.query(
            "SELECT id FROM public.order_security_blocks WHERE order_id=$1 AND cleared_at IS NULL LIMIT 1",
            [input.order_id],
          );
          if (blocks.rows.length)
            return result({ kind: "blocked", reason: "security_block" });
          // Files remain fail-closed until private validation and immutable attachment lifecycle are integrated.
          const files = await tx.query(
            "SELECT file_id FROM public.order_version_files WHERE version_id=$1 LIMIT 1",
            [order.current_version_id],
          );
          if (files.rows.length)
            return result({ kind: "blocked", reason: "files_not_ready" });
          if (
            input.action === "accept" &&
            states.rows.some((r) => r.state === "unavailable") &&
            (!input.confirm_unavailable || !input.reason)
          )
            return result({ kind: "exception_required" });
          if (input.action === "start_manufacturing") {
            const pending = await tx.query(
              "SELECT id FROM public.order_requests WHERE order_id=$1 AND state='pending' LIMIT 1",
              [input.order_id],
            );
            if (pending.rows.length)
              return result({ kind: "blocked", reason: "pending_request" });
          }
        }
        const revision = Number(order.revision) + 1;
        const response = OrderDecisionResultSchema.parse({
          kind: "updated",
          order_id: order.id,
          status: statuses[input.action],
          revision,
          version_id: order.current_version_id,
        });
        const updated = await tx.query(
          "UPDATE public.orders SET status=$2,revision=revision+1,manufacturing_version_id=CASE WHEN $2='manufacturing' THEN current_version_id ELSE manufacturing_version_id END WHERE id=$1 AND revision=$3 RETURNING id",
          [order.id, statuses[input.action], input.expected_revision],
        );
        if (updated.rows.length !== 1)
          throw new Error("ORDER_DECISION_WRITE_CONFLICT");
        const reason = "reason" in input ? (input.reason ?? null) : null,
          eventId = randomUUID(),
          requestId = randomUUID();
        await tx.query(
          "INSERT INTO public.order_status_events(order_id,clinic_id,previous_status,next_status,actor_id,reason,decided_version_id,aggregate_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            order.id,
            order.clinic_id,
            order.status,
            statuses[input.action],
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
            events[input.action],
            order.id,
            revision,
            order.clinic_id,
            actor.accountId,
            requestId,
          ],
        );
        await tx.query(
          "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
          [eventId],
        );
        await tx.query(
          "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,$2,'order',$3,$4,$5,ARRAY['status'])",
          [
            actor.accountId,
            events[input.action].toUpperCase(),
            order.id,
            requestId,
            revision,
          ],
        );
        return result(response);
      });
    },
  };
}
export async function assertOrderDecisionReady(database: DatabaseExecutor) {
  const checked = await database.query(
    `SELECT has_table_privilege(current_user,'public.order_requests','SELECT') AND has_table_privilege(current_user,'public.order_security_blocks','SELECT') AND has_table_privilege(current_user,'public.order_version_files','SELECT') AND has_column_privilege(current_user,'public.orders','status','UPDATE') AND has_column_privilege(current_user,'public.orders','revision','UPDATE') AND has_column_privilege(current_user,'public.orders','manufacturing_version_id','UPDATE') AS ready`,
  );
  if (checked.rows[0]?.ready !== true)
    throw new Error("ORDER_DECISION_STORAGE_NOT_READY");
}
