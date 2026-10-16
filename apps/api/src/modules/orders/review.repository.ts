import { z } from "zod";
import { OrderReviewPageSchema } from "@dental-lab/contracts";
import type { createApplicationDatabase } from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
export function createOrderReviewRepository(
  database: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async list(
      actor: { accountId: string; sessionId: string },
      after?: unknown,
    ) {
      if (after !== undefined && !z.uuid().safeParse(after).success)
        return { kind: "invalid" as const };
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
          !identity.permissions.includes("orders.read_details")
        )
          return { kind: "denied" as const };
        const page = await tx.query(
          `SELECT o.id,o.number::text,c.name AS clinic_name,o.kind,o.origin,o.status,o.revision::text,v.id AS version_id,
 jsonb_strip_nulls(jsonb_build_object('first_name',v.patient_first_name,'last_name',v.patient_last_name,'internal_reference',v.patient_reference)) AS patient,
 to_char(v.requested_delivery_date,'YYYY-MM-DD') AS requested_delivery_date,v.description,m.label AS material,s.label AS shade,w.label AS work_type,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('fdi',t.fdi,'selection',t.selection) ORDER BY t.fdi) FROM public.order_version_teeth t WHERE t.version_id=v.id),'[]'::jsonb) AS teeth,
 (SELECT count(*)::integer FROM public.order_version_files f WHERE f.version_id=v.id) AS file_count,
 EXISTS(SELECT 1 FROM public.order_security_blocks b WHERE b.order_id=o.id AND b.cleared_at IS NULL) AS security_block
 FROM public.orders o JOIN public.clinics c ON c.id=o.clinic_id JOIN public.order_versions v ON v.id=o.current_version_id AND v.order_id=o.id
 JOIN public.catalog_reference_snapshots m ON m.id=v.material_snapshot_id JOIN public.catalog_reference_snapshots s ON s.id=v.shade_snapshot_id LEFT JOIN public.catalog_reference_snapshots w ON w.id=v.work_type_snapshot_id
 WHERE o.status IN ('pending','accepted') AND ($1::uuid IS NULL OR o.id>$1) ORDER BY o.id LIMIT 51`,
          [after ?? null],
        );
        const items = page.rows
          .slice(0, 50)
          .map((row) => ({ ...row, revision: Number(row.revision) }));
        return {
          kind: "page" as const,
          page: OrderReviewPageSchema.parse({
            items,
            next_after: page.rows.length > 50 ? page.rows[49]!.id : null,
          }),
        };
      });
    },
  };
}
