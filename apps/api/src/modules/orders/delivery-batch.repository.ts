import { createHash, randomUUID } from "node:crypto";
import {
  DeliveryBatchCommandSchema,
  DeliveryBatchReceiptQuerySchema,
  DeliveryBatchResultSchema,
} from "@dental-lab/contracts";
import type {
  DeliveryBatchResult,
  DeliveryBatchCommand,
} from "@dental-lab/contracts";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
type Actor = { accountId: string; sessionId: string };
type Outcome =
  | { kind: "invalid" | "denied" }
  | { kind: "result"; result: DeliveryBatchResult };
class AbortBatch extends Error {
  constructor(readonly result: DeliveryBatchResult) {
    super("DELIVERY_BATCH_ABORT");
  }
}
function fingerprint(items: DeliveryBatchCommand["items"]) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        [...items].sort((a, b) => a.order_id.localeCompare(b.order_id)),
      ),
    )
    .digest();
}
async function authorize(tx: DatabaseExecutor, actor: Actor) {
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
    !!identity &&
    identity.profile !== "clinic" &&
    identity.permissions.includes("delivery.mark_delivered")
  );
}
const result = (value: DeliveryBatchResult): Outcome => ({
  kind: "result",
  result: DeliveryBatchResultSchema.parse(value),
});
function abort(value: DeliveryBatchResult): never {
  throw new AbortBatch(value);
}
export function createDeliveryBatchRepository(
  database: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async deliver(actor: Actor, raw: unknown): Promise<Outcome> {
      const parsed = DeliveryBatchCommandSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" };
      const input = parsed.data,
        items = [...input.items].sort((a, b) =>
          a.order_id.localeCompare(b.order_id),
        );
      const hash = fingerprint(items);
      try {
        return await database.transaction(async (tx) => {
          if (!(await authorize(tx, actor))) return { kind: "denied" };
          // The unique key serializes retries. A failed batch rolls back its pending receipt.
          const inserted = await tx.query(
            'INSERT INTO public.delivery_batch_receipts(id,actor_id,payload_hash,result) VALUES($1,$2,$3,\'{"kind":"pending"}\'::jsonb) ON CONFLICT (id) DO NOTHING RETURNING id',
            [input.receipt_id, actor.accountId, hash],
          );
          if (!inserted.rows.length) {
            const prior = await tx.query(
              "SELECT actor_id,payload_hash,result FROM public.delivery_batch_receipts WHERE id=$1",
              [input.receipt_id],
            );
            if (
              !prior.rows.length ||
              prior.rows[0]!.actor_id !== actor.accountId
            )
              return { kind: "denied" };
            if (!Buffer.from(prior.rows[0]!.payload_hash).equals(hash))
              return result({ kind: "receipt_mismatch" });
            return result(
              DeliveryBatchResultSchema.parse(prior.rows[0]!.result),
            );
          }
          const snapshots = new Set<string>();
          for (const item of items) {
            const r = await tx.query(
              "SELECT o.current_version_id,v.material_snapshot_id,v.shade_snapshot_id,v.work_type_snapshot_id FROM public.orders o JOIN public.order_versions v ON v.id=o.current_version_id AND v.order_id=o.id WHERE o.id=$1",
              [item.order_id],
            );
            const row = r.rows[0];
            if (!row || row.current_version_id !== item.expected_version_id)
              abort({ kind: "conflict" });
            snapshots.add(row.material_snapshot_id);
            snapshots.add(row.shade_snapshot_id);
            if (row.work_type_snapshot_id)
              snapshots.add(row.work_type_snapshot_id);
          }
          const refs = await tx.query(
            "SELECT id,reference_id FROM public.catalog_reference_snapshots WHERE id=ANY($1::uuid[]) ORDER BY id",
            [[...snapshots].sort()],
          );
          if (
            refs.rows.length !== snapshots.size ||
            refs.rows.some((r) => !r.reference_id)
          )
            abort({ kind: "blocked", reason: "catalog_missing" });
          const references = [
            ...new Set(refs.rows.map((r) => r.reference_id as string)),
          ].sort();
          await tx.query(
            "SELECT id FROM public.catalog_references WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE",
            [references],
          );
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
            abort({ kind: "blocked", reason: "catalog_missing" });
          if (states.rows.some((r) => r.state === "forbidden"))
            abort({ kind: "blocked", reason: "catalog_forbidden" });
          const locked = [];
          for (const item of items) {
            const r = await tx.query(
              "SELECT id,clinic_id,status,current_version_id,manufacturing_version_id,revision::text FROM public.orders WHERE id=$1 FOR UPDATE",
              [item.order_id],
            );
            const order = r.rows[0];
            if (
              !order ||
              order.current_version_id !== item.expected_version_id ||
              Number(order.revision) !== item.expected_revision ||
              order.status !== "completed"
            )
              abort({ kind: "conflict" });
            if (order.manufacturing_version_id !== order.current_version_id)
              throw new Error("MANUFACTURING_VERSION_INCONSISTENT");
            locked.push(order);
          }
          for (const order of locked) {
            const checks = [
              [
                "SELECT id FROM public.order_security_blocks WHERE order_id=$1 AND cleared_at IS NULL LIMIT 1",
                "security_block",
              ],
              [
                "SELECT file_id FROM public.order_version_files WHERE version_id=$1 LIMIT 1",
                "files_not_ready",
              ],
              [
                "SELECT id FROM public.order_requests WHERE order_id=$1 AND state='pending' LIMIT 1",
                "pending_request",
              ],
            ] as const;
            for (const [sql, reason] of checks) {
              const r = await tx.query(sql, [
                reason === "files_not_ready"
                  ? order.current_version_id
                  : order.id,
              ]);
              if (r.rows.length) abort({ kind: "blocked", reason });
            }
          }
          const stamp = await tx.query("SELECT clock_timestamp()::text AS at");
          const at = stamp.rows[0]?.at as string;
          const delivered = [];
          for (let i = 0; i < items.length; i++) {
            const item = items[i]!,
              order = locked[i]!,
              revision = Number(order.revision) + 1;
            const updated = await tx.query(
              "UPDATE public.orders SET status='delivered',revision=revision+1 WHERE id=$1 AND revision=$2 AND status='completed' RETURNING id",
              [order.id, item.expected_revision],
            );
            if (updated.rows.length !== 1)
              throw new Error("DELIVERY_BATCH_WRITE_CONFLICT");
            const before = await tx.query(
              "SELECT to_jsonb(l) AS values FROM public.order_logistics l WHERE order_id=$1 FOR UPDATE",
              [order.id],
            );
            if (before.rows.length !== 1)
              throw new Error("ORDER_LOGISTICS_MISSING");
            const after = await tx.query(
              "UPDATE public.order_logistics l SET delivery_mode=$2,delivered_at=$3::timestamptz,delivered_by=$4,archive_due_at=$3::timestamptz+interval '30 days',revision=l.revision+1 WHERE order_id=$1 RETURNING to_jsonb(l) AS values",
              [order.id, item.mode, at, actor.accountId],
            );
            if (after.rows.length !== 1)
              throw new Error("ORDER_LOGISTICS_WRITE_CONFLICT");
            await tx.query(
              "INSERT INTO public.order_logistics_events(order_id,clinic_id,actor_id,before_values,after_values,reason) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,NULL)",
              [
                order.id,
                order.clinic_id,
                actor.accountId,
                JSON.stringify(before.rows[0]!.values),
                JSON.stringify(after.rows[0]!.values),
              ],
            );
            const conversation = await tx.query(
              "UPDATE public.conversations SET closed_at=$2::timestamptz,revision=revision+1 WHERE order_id=$1 AND kind='order' RETURNING id",
              [order.id, at],
            );
            if (conversation.rows.length !== 1)
              throw new Error("ORDER_CONVERSATION_MISSING");
            await tx.query(
              "INSERT INTO public.order_status_events(order_id,clinic_id,previous_status,next_status,actor_id,reason,decided_version_id,aggregate_revision) VALUES($1,$2,'completed','delivered',$3,NULL,$4,$5)",
              [
                order.id,
                order.clinic_id,
                actor.accountId,
                order.current_version_id,
                revision,
              ],
            );
            const event = randomUUID();
            await tx.query(
              "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,actor_id,correlation_id) VALUES($1,'order_delivered','order',$2,$3,$4,$5,$6)",
              [
                event,
                order.id,
                revision,
                order.clinic_id,
                actor.accountId,
                input.receipt_id,
              ],
            );
            await tx.query(
              "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
              [event],
            );
            await tx.query(
              "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,'ORDER_DELIVERED','order',$2,$3,$4,ARRAY['status'])",
              [actor.accountId, order.id, input.receipt_id, revision],
            );
            delivered.push({ order_id: order.id as string, revision });
          }
          const receipt = DeliveryBatchResultSchema.parse({
            kind: "delivered",
            receipt_id: input.receipt_id,
            delivered_at: at,
            items: delivered,
          });
          await tx.query(
            "UPDATE public.delivery_batch_receipts SET result=$2::jsonb WHERE id=$1",
            [input.receipt_id, JSON.stringify(receipt)],
          );
          return result(receipt);
        });
      } catch (error) {
        if (error instanceof AbortBatch) return result(error.result);
        throw error;
      }
    },
    async receipt(actor: Actor, raw: unknown): Promise<Outcome> {
      const parsed = DeliveryBatchReceiptQuerySchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" };
      return database.transaction(async (tx) => {
        if (!(await authorize(tx, actor))) return { kind: "denied" };
        const r = await tx.query(
          "SELECT result FROM public.delivery_batch_receipts WHERE id=$1 AND actor_id=$2",
          [parsed.data.receipt_id, actor.accountId],
        );
        return result(
          r.rows.length
            ? DeliveryBatchResultSchema.parse(r.rows[0]!.result)
            : { kind: "receipt_missing" },
        );
      });
    },
  };
}
export async function assertDeliveryBatchReady(db: DatabaseExecutor) {
  const r = await db.query(
    "SELECT to_regclass('public.delivery_batch_receipts') IS NOT NULL AND has_table_privilege(current_user,'public.delivery_batch_receipts','SELECT') AND has_table_privilege(current_user,'public.delivery_batch_receipts','INSERT') AND has_column_privilege(current_user,'public.delivery_batch_receipts','result','UPDATE') AS ready",
  );
  if (r.rows[0]?.ready !== true)
    throw new Error("DELIVERY_BATCH_STORAGE_NOT_READY");
}
