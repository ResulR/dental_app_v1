import type { DatabaseExecutor } from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
// Lock live identity and grants before an upload session is read or changed.
// This variant is intentionally limited to an approved clinic's own transfers.
export async function uploadClinicAuthority(
  tx: DatabaseExecutor,
  actor: { accountId: string; sessionId: string },
) {
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
  const current = await createCurrentPermissionsRepository(tx).current(actor);
  if (current?.profile !== "clinic") return null;
  const approved = await tx.query(
    "SELECT id FROM public.clinics WHERE account_id=$1 AND review_state='approved' AND NOT suspended",
    [actor.accountId],
  );
  return approved.rows.length === 1 ? (approved.rows[0]!.id as string) : null;
}
