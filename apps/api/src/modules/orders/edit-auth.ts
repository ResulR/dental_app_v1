import type { DatabaseExecutor } from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
export async function editAuthority(
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
  const identity = await createCurrentPermissionsRepository(tx).current(actor);
  if (!identity) return null;
  if (identity.profile === "clinic") {
    const c = await tx.query(
      "SELECT id FROM public.clinics WHERE account_id=$1 AND review_state='approved' AND NOT suspended",
      [actor.accountId],
    );
    if (c.rows.length !== 1) return null;
    return { clinicId: c.rows[0]!.id as string, clinic: true };
  }
  return identity.permissions.includes("orders.edit_instructions")
    ? { clinicId: null, clinic: false }
    : null;
}
