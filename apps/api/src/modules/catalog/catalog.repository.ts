import {
  ActiveCatalogPageSchema,
  CatalogKindSchema,
  ClinicIdSchema,
} from "@dental-lab/contracts";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
type Database = Pick<
  ReturnType<typeof createApplicationDatabase>,
  "transaction"
>;
export function createCatalogRepository(database: Database) {
  return {
    async list(
      actor: { accountId: string; sessionId: string },
      kind: unknown,
      after?: unknown,
    ) {
      const parsed = CatalogKindSchema.safeParse(kind);
      if (
        !parsed.success ||
        (after !== undefined && !ClinicIdSchema.safeParse(after).success)
      )
        throw new Error("INVALID_CATALOG_QUERY");
      return database.transaction(async (tx) => {
        // Same lock order as account administration; no rights cache for subsequent pages.
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
          !(
            identity.profile === "owner" ||
            identity.profile === "clinic" ||
            identity.permissions.includes("catalog.manage") ||
            identity.permissions.includes("orders.create_for_clinic")
          )
        )
          return null;
        const result = await tx.query<{
          id: string;
          kind: string;
          label: string;
          revision: string;
        }>(
          `SELECT r.id,r.kind,e.label,r.revision::text FROM public.catalog_references r JOIN public.catalog_entries e ON e.reference_id=r.id WHERE r.kind=$1 AND r.use_state='available' AND e.is_active AND ($2::uuid IS NULL OR r.id>$2) ORDER BY r.id LIMIT 51`,
          [parsed.data, after ?? null],
        );
        const items = result.rows
          .slice(0, 50)
          .map((row) => ({ ...row, revision: Number(row.revision) }));
        return ActiveCatalogPageSchema.parse({
          items,
          next_after: result.rows.length > 50 ? items[49]!.id : null,
        });
      });
    },
  };
}
export async function assertCatalogStorageReady(database: DatabaseExecutor) {
  const result = await database.query<{ ready: boolean }>(
    `SELECT has_table_privilege(current_user,'public.catalog_references','SELECT') AND has_table_privilege(current_user,'public.catalog_entries','SELECT') AND has_table_privilege(current_user,'public.account_grants','DELETE') AS ready`,
  );
  if (result.rows[0]?.ready !== true)
    throw new Error("CATALOG_STORAGE_NOT_READY");
}
