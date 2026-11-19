import { EmailRecipientCategorySchema } from "@dental-lab/contracts";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
import { currentRequestCorrelation } from "../../shared/request-correlation.js";

export const laboratoryEmailCategories = EmailRecipientCategorySchema.options;
export type LaboratoryEmailCategory =
  (typeof laboratoryEmailCategories)[number];
type Actor = { accountId: string; sessionId: string };
type Database = Pick<
  ReturnType<typeof createApplicationDatabase>,
  "transaction"
>;

async function currentOwner(tx: DatabaseExecutor, actor: Actor) {
  const session = await tx.query(
    "SELECT id FROM public.sessions WHERE id=$1 AND account_id=$2 FOR SHARE",
    [actor.sessionId, actor.accountId],
  );
  if (session.rows.length !== 1) return false;
  const current = await createCurrentPermissionsRepository(tx).current(actor);
  return current?.profile === "owner";
}

// Existing account locks serialize with admin grant/lifecycle changes. A scoped
// advisory lock serializes absent recipient rows as well as present ones.
export function createEmailRecipientsRepository(db: Database) {
  return {
    async list(actor: Actor, accountId: string) {
      return db.transaction(async (tx) => {
        await tx.query(
          "SELECT id FROM public.accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE",
          [[actor.accountId, accountId]],
        );
        await tx.query("LOCK TABLE public.account_grants IN SHARE MODE");
        if (!(await currentOwner(tx, actor)))
          return { kind: "denied" as const };
        const target = await tx.query(
          "SELECT id FROM public.accounts WHERE id=$1 AND profile='admin'",
          [accountId],
        );
        if (target.rows.length !== 1) return { kind: "denied" as const };
        const rows = await tx.query<{ category: LaboratoryEmailCategory }>(
          "SELECT category FROM public.email_category_recipients WHERE account_id=$1 AND category=ANY($2::text[]) ORDER BY category",
          [accountId, laboratoryEmailCategories],
        );
        return {
          kind: "result" as const,
          categories: rows.rows.map((r) => r.category),
        };
      });
    },
    async change(
      actor: Actor,
      accountId: string,
      category: LaboratoryEmailCategory,
      expectedSelected: boolean,
      selected: boolean,
    ) {
      return db.transaction(async (tx) => {
        await tx.query(
          "SELECT id FROM public.accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
          [[actor.accountId, accountId]],
        );
        await tx.query("LOCK TABLE public.account_grants IN SHARE MODE");
        if (!(await currentOwner(tx, actor)))
          return { kind: "denied" as const };
        const target = await tx.query<{
          lifecycle: string;
          security_locked: boolean;
          credential_reset_required: boolean;
        }>(
          "SELECT lifecycle,security_locked,credential_reset_required FROM public.accounts WHERE id=$1 AND profile='admin'",
          [accountId],
        );
        if (target.rows.length !== 1) return { kind: "denied" as const };
        // Transaction-scoped and keyed by account/category; no JS-process lock.
        await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          `email-recipient:${accountId}:${category}`,
        ]);
        const existing = await tx.query(
          "SELECT 1 FROM public.email_category_recipients WHERE account_id=$1 AND category=$2",
          [accountId, category],
        );
        if ((existing.rows.length === 1) !== expectedSelected)
          return { kind: "conflict" as const };
        if (selected === expectedSelected) return { kind: "applied" as const };
        if (selected) {
          const eligible = target.rows[0]!;
          if (
            eligible.lifecycle !== "active" ||
            eligible.security_locked ||
            eligible.credential_reset_required
          )
            return { kind: "denied" as const };
          const eligibleGrant =
            category === "message_reminder"
              ? await tx.query(
                  `SELECT 1 WHERE EXISTS(SELECT 1 FROM public.account_grants g
                    WHERE g.account_id=$1 AND g.permission_code='messaging.general.read')
                    OR (EXISTS(SELECT 1 FROM public.account_grants g WHERE g.account_id=$1
                      AND g.permission_code='messaging.order.read')
                    AND EXISTS(SELECT 1 FROM public.account_grants g WHERE g.account_id=$1
                      AND g.permission_code='orders.read_logistics'))`,
                  [accountId],
                )
              : await tx.query(
                  "SELECT 1 FROM public.account_grants WHERE account_id=$1 AND permission_code=ANY($2::text[]) GROUP BY account_id HAVING count(DISTINCT permission_code)=$3",
                  [
                    accountId,
                    category === "clinic_registered"
                      ? ["clinics.manage"]
                      : ["orders.read_details", "orders.read_logistics"],
                    category === "clinic_registered" ? 1 : 2,
                  ],
                );
          if (eligibleGrant.rows.length !== 1)
            return { kind: "denied" as const };
          await tx.query(
            "INSERT INTO public.email_category_recipients(category,account_id,changed_by) VALUES($1,$2,$3)",
            [category, accountId, actor.accountId],
          );
        } else {
          await tx.query(
            "DELETE FROM public.email_category_recipients WHERE category=$1 AND account_id=$2",
            [category, accountId],
          );
        }
        await tx.query(
          "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,reason_code,changed_fields) VALUES($1,'EMAIL_RECIPIENT_CHANGED','account',$2,$3,$4,ARRAY['permissions']::text[])",
          [
            actor.accountId,
            accountId,
            currentRequestCorrelation(),
            category.toUpperCase() + (selected ? "_ADDED" : "_REMOVED"),
          ],
        );
        return { kind: "applied" as const };
      });
    },
  };
}
export async function assertEmailRecipientsReady(db: DatabaseExecutor) {
  const result = await db.query(
    `SELECT has_table_privilege(current_user,'public.email_category_recipients','SELECT')
       AND has_table_privilege(current_user,'public.email_category_recipients','INSERT')
       AND has_table_privilege(current_user,'public.email_category_recipients','DELETE')
       AND has_table_privilege(current_user,'public.audit_events','INSERT')
       AND EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c
         WHERE c.conrelid='public.email_category_recipients'::regclass
           AND c.conname='email_category_recipients_category_check'
           AND pg_catalog.pg_get_constraintdef(c.oid) LIKE '%message_reminder%') AS ready`,
  );
  if (result.rows[0]?.ready !== true)
    throw new Error("EMAIL_RECIPIENTS_UNAVAILABLE");
}
