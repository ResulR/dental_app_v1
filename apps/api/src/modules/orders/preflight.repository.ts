import {
  OrderPreflightInputSchema,
  OrderPreflightResultSchema,
} from "@dental-lab/contracts";
import type { createApplicationDatabase } from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
import { readCatalogForUse } from "../catalog/index.js";
type Actor = { accountId: string; sessionId: string };
export function createOrderPreflightRepository(
  database: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async check(actor: Actor, raw: unknown) {
      const parsed = OrderPreflightInputSchema.safeParse(raw);
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
        const clinic = await tx.query(
          "SELECT id FROM public.clinics WHERE account_id=$1 AND review_state='approved' AND NOT suspended",
          [actor.accountId],
        );
        if (clinic.rows.length !== 1) return { kind: "denied" as const };
        const input = parsed.data,
          { missing, references } = await readCatalogForUse(tx, input);
        const reasons: (
          "catalog_forbidden" | "catalog_missing" | "files_not_ready"
        )[] = [];
        const warnings: ("catalog_unavailable" | "low_detail")[] = [];
        if (missing) reasons.push("catalog_missing");
        if (references.some((r) => r.state === "forbidden"))
          reasons.push("catalog_forbidden");
        if (input.file_ids.length) reasons.push("files_not_ready");
        if (references.some((r) => r.state === "unavailable"))
          warnings.push("catalog_unavailable");
        if (!input.teeth.length && !input.description?.trim())
          warnings.push("low_detail");
        return {
          kind: "checked" as const,
          result: OrderPreflightResultSchema.parse({
            persisted: false,
            status: reasons.length ? "blocked" : "checked",
            reasons,
            warnings,
            references,
          }),
        };
      });
    },
  };
}
