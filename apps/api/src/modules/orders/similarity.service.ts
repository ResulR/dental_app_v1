import {
  OrderSimilarityInputSchema,
  OrderSimilarityResultSchema,
} from "@dental-lab/contracts";
import type { createApplicationDatabase } from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";

type Actor = { accountId: string; sessionId: string };

// Hints use the current version only, the same clinic, requested date,
// material and shade. Identity is a reference OR full name, never name alone.
export function createOrderSimilarityService(
  database: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async check(actor: Actor, raw: unknown) {
      const parsed = OrderSimilarityInputSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return database.transaction(async (tx) => {
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
        const identity =
          await createCurrentPermissionsRepository(tx).current(actor);
        if (identity?.profile !== "clinic") return { kind: "denied" as const };
        const clinics = await tx.query<{ id: string }>(
          "SELECT id FROM public.clinics WHERE account_id=$1 AND review_state='approved' AND NOT suspended",
          [actor.accountId],
        );
        if (clinics.rows.length !== 1) return { kind: "denied" as const };
        const input = parsed.data;
        const result = await tx.query<{
          order_id: string;
          number: string;
          signal: "same_reference_and_work" | "same_name_and_work";
        }>(
          `SELECT o.id AS order_id,o.number::text AS number,
             CASE WHEN $2::text IS NOT NULL AND v.patient_reference IS NOT NULL
               AND lower(btrim(v.patient_reference))=lower(btrim($2::text))
               THEN 'same_reference_and_work' ELSE 'same_name_and_work' END AS signal
           FROM public.orders o
           JOIN public.order_versions v ON v.id=o.current_version_id
             AND v.order_id=o.id AND v.clinic_id=o.clinic_id
           JOIN public.catalog_reference_snapshots m ON m.id=v.material_snapshot_id
           JOIN public.catalog_reference_snapshots s ON s.id=v.shade_snapshot_id
           WHERE o.clinic_id=$1 AND o.kind='normal'
             AND v.requested_delivery_date=$5::date
             AND m.reference_id=$6::uuid AND s.reference_id=$7::uuid
             AND (
               ($2::text IS NOT NULL AND v.patient_reference IS NOT NULL
                 AND lower(btrim(v.patient_reference))=lower(btrim($2::text)))
               OR ($3::text IS NOT NULL AND $4::text IS NOT NULL
                 AND v.patient_first_name IS NOT NULL AND v.patient_last_name IS NOT NULL
                 AND lower(btrim(v.patient_first_name))=lower(btrim($3::text))
                 AND lower(btrim(v.patient_last_name))=lower(btrim($4::text)))
             )
           ORDER BY o.received_at DESC,o.id DESC LIMIT 3`,
          [
            clinics.rows[0]!.id,
            input.patient.internal_reference ?? null,
            input.patient.first_name ?? null,
            input.patient.last_name ?? null,
            input.requested_delivery_date,
            input.material_id,
            input.shade_id,
          ],
        );
        return {
          kind: "checked" as const,
          result: OrderSimilarityResultSchema.parse({ matches: result.rows }),
        };
      });
    },
  };
}
