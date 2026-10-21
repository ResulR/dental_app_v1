import { OrderFilesQuerySchema } from "@dental-lab/contracts";
import type { OrderFilesPage } from "@dental-lab/contracts";
import { readOrderFileMetadata } from "../files/index.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
import type {
  OrderTrackingPage,
  OrderTrackingDetail,
} from "@dental-lab/contracts";
import {
  OrderSearchSchema,
  OrderTrackingPageSchema,
  OrderDetailQuerySchema,
  OrderTrackingDetailSchema,
} from "@dental-lab/contracts";
import type { createApplicationDatabase } from "../../shared/database.js";
import { trackingAuthority } from "./tracking-auth.js";
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v);
type TrackingActor = { accountId: string; sessionId: string };
type TrackingFailure = { kind: "invalid" } | { kind: "denied" };
export interface OrderTrackingRepository {
  files(
    actor: TrackingActor,
    raw: unknown,
  ): Promise<TrackingFailure | { kind: "page"; page: OrderFilesPage }>;
  search(
    actor: TrackingActor,
    raw: unknown,
  ): Promise<TrackingFailure | { kind: "page"; page: OrderTrackingPage }>;
  detail(
    actor: TrackingActor,
    raw: unknown,
  ): Promise<TrackingFailure | { kind: "detail"; detail: OrderTrackingDetail }>;
}
export function createOrderTrackingRepository(
  database: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
): OrderTrackingRepository {
  return {
    async files(actor: TrackingActor, raw: unknown) {
      const parsed = OrderFilesQuerySchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      const input = parsed.data;
      return database.transaction(async (tx) => {
        const auth = await trackingAuthority(tx, actor);
        if (!auth?.details) return { kind: "denied" as const };
        if (auth.clinicId === null) {
          const identity =
            await createCurrentPermissionsRepository(tx).current(actor);
          if (!identity?.permissions.includes("files.view"))
            return { kind: "denied" as const };
        }
        const parent = await tx.query(
          "SELECT id,clinic_id,current_version_id FROM public.orders WHERE id=$1 AND ($2::uuid IS NULL OR clinic_id=$2) FOR SHARE",
          [input.order_id, auth.clinicId],
        );
        if (
          parent.rows.length !== 1 ||
          parent.rows[0]!.current_version_id !== input.version_id
        )
          return { kind: "denied" as const };
        return {
          kind: "page" as const,
          page: await readOrderFileMetadata(tx, {
            orderId: input.order_id,
            versionId: input.version_id,
            clinicId: String(parent.rows[0]!.clinic_id),
            ...(input.after ? { after: input.after } : {}),
          }),
        };
      });
    },
    async search(
      actor: { accountId: string; sessionId: string },
      raw: unknown,
    ) {
      const parsed = OrderSearchSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      const input = parsed.data;
      return database.transaction(async (tx) => {
        const auth = await trackingAuthority(tx, actor);
        if (!auth) return { kind: "denied" as const };
        const patient = auth.details
          ? " OR strpos(lower(concat_ws(' ',v.patient_first_name,v.patient_last_name,v.patient_reference)),lower($3))>0"
          : "";
        const rows = await tx.query(
          `SELECT o.id,o.number::text,c.name AS clinic_name,o.kind,o.origin,o.status,o.received_at,to_char(v.requested_delivery_date,'YYYY-MM-DD') AS requested_delivery_date,to_char(l.planned_delivery_date,'YYYY-MM-DD') AS planned_delivery_date,l.priority
 FROM public.orders o JOIN public.clinics c ON c.id=o.clinic_id JOIN public.order_versions v ON v.id=o.current_version_id AND v.order_id=o.id JOIN public.order_logistics l ON l.order_id=o.id
 WHERE ($1::uuid IS NULL OR o.clinic_id=$1) AND ($2::uuid IS NULL OR o.id>$2) AND ($3='' OR strpos(o.number::text,$3)>0 OR strpos(lower(c.name),lower($3))>0${patient})
 AND ($4::text IS NULL OR o.status=$4) AND ($5::text IS NULL OR o.kind=$5)
 AND (CASE WHEN $9::text='archive' THEN o.status='delivered' AND l.archive_due_at<=statement_timestamp()
           ELSE o.status<>'delivered' OR l.archive_due_at IS NULL OR l.archive_due_at>statement_timestamp() END)
 AND ($7::date IS NULL OR CASE WHEN $6='planned' THEN l.planned_delivery_date WHEN $6='effective' THEN COALESCE(l.planned_delivery_date,v.requested_delivery_date) ELSE v.requested_delivery_date END >=$7::date)
 AND ($8::date IS NULL OR CASE WHEN $6='planned' THEN l.planned_delivery_date WHEN $6='effective' THEN COALESCE(l.planned_delivery_date,v.requested_delivery_date) ELSE v.requested_delivery_date END <=$8::date)
 ORDER BY o.id LIMIT 51`,
          [
            auth.clinicId,
            input.after ?? null,
            input.q ?? "",
            input.status ?? null,
            input.kind ?? null,
            input.date_kind,
            input.from ?? null,
            input.to ?? null,
            input.view,
          ],
        );
        return {
          kind: "page" as const,
          page: OrderTrackingPageSchema.parse({
            can_read_details: auth.details,
            items: rows.rows
              .slice(0, 50)
              .map((r) => ({ ...r, received_at: iso(r.received_at) })),
            next_after: rows.rows.length > 50 ? rows.rows[49]!.id : null,
          }),
        };
      });
    },
    async detail(
      actor: { accountId: string; sessionId: string },
      raw: unknown,
    ) {
      const parsed = OrderDetailQuerySchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      const input = parsed.data;
      return database.transaction(async (tx) => {
        const auth = await trackingAuthority(tx, actor);
        if (!auth?.details) return { kind: "denied" as const };
        const locked = await tx.query(
          "SELECT id FROM public.orders WHERE id=$1 AND ($2::uuid IS NULL OR clinic_id=$2) FOR SHARE",
          [input.order_id, auth.clinicId],
        );
        if (locked.rows.length !== 1) return { kind: "denied" as const };
        const details = await tx.query(
          `SELECT o.id,o.number::text,c.name AS clinic_name,o.kind,o.origin,o.status,o.revision::text,o.received_at,to_char(l.planned_delivery_date,'YYYY-MM-DD') AS planned_delivery_date,l.priority,v.id AS version_id,
 jsonb_strip_nulls(jsonb_build_object('first_name',v.patient_first_name,'last_name',v.patient_last_name,'internal_reference',v.patient_reference)) AS patient,
 to_char(v.requested_delivery_date,'YYYY-MM-DD') AS requested_delivery_date,v.description,m.label AS material,s.label AS shade,w.label AS work_type,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('fdi',t.fdi,'selection',t.selection) ORDER BY t.fdi) FROM public.order_version_teeth t WHERE t.version_id=v.id),'[]'::jsonb) AS teeth,
 (SELECT count(*)::integer FROM public.order_version_files f WHERE f.version_id=v.id) AS file_count,
 EXISTS(SELECT 1 FROM public.order_security_blocks b WHERE b.order_id=o.id AND b.cleared_at IS NULL) AS security_block
 FROM public.orders o JOIN public.order_logistics l ON l.order_id=o.id JOIN public.clinics c ON c.id=o.clinic_id JOIN public.order_versions v ON v.id=o.current_version_id AND v.order_id=o.id
 JOIN public.catalog_reference_snapshots m ON m.id=v.material_snapshot_id JOIN public.catalog_reference_snapshots s ON s.id=v.shade_snapshot_id LEFT JOIN public.catalog_reference_snapshots w ON w.id=v.work_type_snapshot_id
 WHERE o.id=$1 AND ($2::uuid IS NULL OR o.clinic_id=$2)`,
          [input.order_id, auth.clinicId],
        );
        if (details.rows.length !== 1)
          throw new Error("ORDER_DETAIL_INCOMPLETE");
        const history = await tx.query(
          "SELECT previous_status,next_status,occurred_at,reason,actor_id,aggregate_revision::text,decided_version_id FROM public.order_status_events WHERE order_id=$1 AND ($2::bigint IS NULL OR aggregate_revision<$2) ORDER BY aggregate_revision DESC LIMIT 101",
          [input.order_id, input.before_revision ?? null],
        );
        const order = details.rows[0]!;
        return {
          kind: "detail" as const,
          detail: OrderTrackingDetailSchema.parse({
            order: {
              ...order,
              revision: Number(order.revision),
              received_at: iso(order.received_at),
            },
            history: history.rows.slice(0, 100).map((r) => ({
              ...r,
              aggregate_revision: Number(r.aggregate_revision),
              occurred_at: iso(r.occurred_at),
            })),
            next_before_revision:
              history.rows.length > 100
                ? Number(history.rows[99]!.aggregate_revision)
                : null,
          }),
        };
      });
    },
  };
}
