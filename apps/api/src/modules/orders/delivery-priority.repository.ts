import { randomUUID } from "node:crypto";
import {
  DeliveryPriorityQuerySchema,
  DeliveryPriorityCommandSchema,
  DeliveryPriorityContextSchema,
  DeliveryPriorityResultSchema,
} from "@dental-lab/contracts";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
type Actor = { accountId: string; sessionId: string };
async function authorized(tx: DatabaseExecutor, actor: Actor) {
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
  return (
    identity?.profile !== "clinic" &&
    identity?.permissions.includes("delivery.set_priority")
  );
}
export function createDeliveryPriorityRepository(
  db: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async context(actor: Actor, raw: unknown) {
      const parsed = DeliveryPriorityQuerySchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return db.transaction(async (tx) => {
        if (!(await authorized(tx, actor))) return { kind: "denied" as const };
        const r = await tx.query(
          `SELECT o.id AS order_id,o.status,o.current_version_id AS version_id,
           o.revision::text AS order_revision,l.revision::text AS logistics_revision,l.priority
           FROM public.orders o JOIN public.order_logistics l ON l.order_id=o.id AND l.clinic_id=o.clinic_id
           WHERE o.id=$1 FOR SHARE OF o,l`,
          [parsed.data.order_id],
        );
        if (r.rows.length !== 1) return { kind: "denied" as const };
        const changes = await tx.query(
          `SELECT id,occurred_at,before_values->'priority' AS before,after_values->'priority' AS after
           FROM public.order_logistics_events WHERE order_id=$1
             AND before_values->'priority' IS DISTINCT FROM after_values->'priority'
           ORDER BY occurred_at DESC,id DESC LIMIT 21`,
          [parsed.data.order_id],
        );
        const row = r.rows[0]!;
        return {
          kind: "result" as const,
          result: DeliveryPriorityContextSchema.parse({
            ...row,
            order_revision: Number(row.order_revision),
            logistics_revision: Number(row.logistics_revision),
            recent_changes: changes.rows.slice(0, 20).map((change) => ({
              ...change,
              occurred_at:
                change.occurred_at instanceof Date
                  ? change.occurred_at.toISOString()
                  : change.occurred_at,
            })),
            more_history: changes.rows.length > 20,
          }),
        };
      });
    },
    async update(actor: Actor, raw: unknown) {
      const parsed = DeliveryPriorityCommandSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      const input = parsed.data;
      return db.transaction(async (tx) => {
        if (!(await authorized(tx, actor))) return { kind: "denied" as const };
        const result = (value: unknown) => ({
          kind: "result" as const,
          result: DeliveryPriorityResultSchema.parse(value),
        });
        const orders = await tx.query(
          "SELECT id,clinic_id,status,current_version_id,revision::text FROM public.orders WHERE id=$1 FOR UPDATE",
          [input.order_id],
        );
        const order = orders.rows[0];
        if (!order) return { kind: "denied" as const };
        if (
          order.current_version_id !== input.expected_version_id ||
          Number(order.revision) !== input.expected_order_revision
        )
          return result({ kind: "conflict" });
        if (["delivered", "rejected", "cancelled"].includes(order.status))
          return result({ kind: "closed" });
        const before = await tx.query(
          "SELECT to_jsonb(l) AS values,revision::text,priority FROM public.order_logistics l WHERE order_id=$1 AND clinic_id=$2 FOR UPDATE",
          [order.id, order.clinic_id],
        );
        if (before.rows.length !== 1)
          throw new Error("DELIVERY_PRIORITY_LOGISTICS_MISSING");
        const logistics = before.rows[0]!;
        if (Number(logistics.revision) !== input.expected_logistics_revision)
          return result({ kind: "conflict" });
        if (logistics.priority === input.priority)
          return result({ kind: "unchanged" });
        const aggregate = await tx.query(
          "UPDATE public.orders SET revision=revision+1 WHERE id=$1 AND revision=$2 RETURNING revision::text",
          [order.id, input.expected_order_revision],
        );
        if (aggregate.rows.length !== 1)
          throw new Error("DELIVERY_PRIORITY_ORDER_CONFLICT");
        const after = await tx.query(
          `UPDATE public.order_logistics l SET priority=$3,revision=revision+1
           WHERE order_id=$1 AND clinic_id=$2 AND revision=$4 RETURNING to_jsonb(l) AS values,revision::text`,
          [
            order.id,
            order.clinic_id,
            input.priority,
            input.expected_logistics_revision,
          ],
        );
        if (after.rows.length !== 1)
          throw new Error("DELIVERY_PRIORITY_WRITE_CONFLICT");
        const event = randomUUID(),
          correlation = randomUUID();
        await tx.query(
          "INSERT INTO public.order_logistics_events(order_id,clinic_id,actor_id,before_values,after_values) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)",
          [
            order.id,
            order.clinic_id,
            actor.accountId,
            JSON.stringify(logistics.values),
            JSON.stringify(after.rows[0]!.values),
          ],
        );
        await tx.query(
          "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,actor_id,correlation_id) VALUES($1,'logistics_changed','order',$2,$3,$4,$5,$6)",
          [
            event,
            order.id,
            aggregate.rows[0]!.revision,
            order.clinic_id,
            actor.accountId,
            correlation,
          ],
        );
        await tx.query(
          "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
          [event],
        );
        await tx.query(
          "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,'DELIVERY_PRIORITY_CHANGED','order',$2,$3,$4,ARRAY['priority'])",
          [actor.accountId, order.id, correlation, aggregate.rows[0]!.revision],
        );
        return result({
          kind: "updated",
          priority: input.priority,
          logistics_revision: Number(after.rows[0]!.revision),
        });
      });
    },
  };
}
export async function assertDeliveryPriorityReady(db: DatabaseExecutor) {
  const r = await db.query(
    `SELECT to_regclass('public.order_logistics_events') IS NOT NULL
      AND has_table_privilege(current_user,'public.order_logistics_events','SELECT')
      AND has_table_privilege(current_user,'public.order_logistics_events','INSERT')
      AND has_table_privilege(current_user,'public.outbox_events','INSERT')
      AND has_table_privilege(current_user,'public.outbox_dispatches','INSERT')
      AND has_table_privilege(current_user,'public.audit_events','INSERT')
      AND has_column_privilege(current_user,'public.orders','revision','UPDATE')
      AND has_column_privilege(current_user,'public.order_logistics','priority','UPDATE')
      AND has_column_privilege(current_user,'public.order_logistics','revision','UPDATE') AS ready`,
  );
  if (r.rows[0]?.ready !== true)
    throw new Error("DELIVERY_PRIORITY_STORAGE_NOT_READY");
}
