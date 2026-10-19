import {
  LinkedWorkQuerySchema,
  LinkedWorkPageSchema,
} from "@dental-lab/contracts";
import type { createApplicationDatabase } from "../../shared/database.js";
import { readOrderTrackingAuthority } from "../orders/index.js";
export function createLinkedWorkTrackingRepository(
  db: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async list(actor: { accountId: string; sessionId: string }, raw: unknown) {
      const parsed = LinkedWorkQuerySchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return db.transaction(async (tx) => {
        const auth = await readOrderTrackingAuthority(tx, actor);
        if (!auth) return { kind: "denied" as const };
        const orders = await tx.query(
          "SELECT id,number::text,status FROM public.orders WHERE id=$1 AND ($2::uuid IS NULL OR clinic_id=$2) FOR SHARE",
          [parsed.data.order_id, auth.clinicId],
        );
        if (orders.rows.length !== 1) return { kind: "denied" as const };
        const links = await tx.query(
          `SELECT w.id,w.kind,w.intervention_kind,w.created_at,
jsonb_build_object('id',s.id,'number',s.number::text,'status',s.status) AS source,
jsonb_build_object('id',c.id,'number',c.number::text,'status',c.status) AS child
FROM public.work_links w JOIN public.orders s ON s.id=w.source_order_id AND s.clinic_id=w.clinic_id JOIN public.orders c ON c.id=w.child_order_id AND c.clinic_id=w.clinic_id
WHERE (w.source_order_id=$1 OR w.child_order_id=$1) AND ($2::uuid IS NULL OR w.clinic_id=$2) AND ($3::uuid IS NULL OR w.id>$3) ORDER BY w.id LIMIT 51`,
          [parsed.data.order_id, auth.clinicId, parsed.data.after ?? null],
        );
        return {
          kind: "result" as const,
          result: LinkedWorkPageSchema.parse({
            order: orders.rows[0],
            can_read_details: auth.details,
            items: links.rows.slice(0, 50).map((row) => ({
              ...row,
              created_at:
                row.created_at instanceof Date
                  ? row.created_at.toISOString()
                  : row.created_at,
            })),
            next_after: links.rows.length > 50 ? links.rows[49]!.id : null,
          }),
        };
      });
    },
  };
}
