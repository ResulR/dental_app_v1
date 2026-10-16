import { randomUUID } from "node:crypto";
import {
  LaboratoryProfileSchema,
  LaboratoryUpdateSchema,
  LaboratoryHistorySchema,
} from "@dental-lab/contracts";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { currentRequestCorrelation } from "../../shared/request-correlation.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
type Database = Pick<
  ReturnType<typeof createApplicationDatabase>,
  "transaction"
>;
type Actor = { accountId: string; sessionId: string };
const id = "86000000-0000-4000-8000-000000000001";
export function createLaboratorySettingsRepository(database: Database) {
  async function authorize(
    tx: DatabaseExecutor,
    actor: Actor,
    manage: boolean,
  ) {
    await tx.query("SELECT id FROM public.accounts WHERE id=$1 FOR SHARE", [
      actor.accountId,
    ]);
    await tx.query("LOCK TABLE public.account_grants IN SHARE MODE");
    await tx.query(
      "SELECT id FROM public.sessions WHERE id=$1 AND account_id=$2 FOR SHARE",
      [actor.sessionId, actor.accountId],
    );
    // Clinical suspension can change independently from account state.
    await tx.query(
      "SELECT id FROM public.clinics WHERE account_id=$1 FOR SHARE",
      [actor.accountId],
    );
    const identity =
      await createCurrentPermissionsRepository(tx).current(actor);
    return (
      !!identity &&
      (!manage ||
        (identity.profile !== "clinic" &&
          identity.permissions.includes("settings.manage")))
    );
  }
  async function profile(tx: DatabaseExecutor, lock: boolean) {
    const result = await tx.query(
      "SELECT revision::text,fields FROM public.laboratory_public_settings WHERE id=$1" +
        (lock ? " FOR UPDATE" : ""),
      [id],
    );
    if (result.rows.length !== 1)
      throw new Error("LABORATORY_SETTINGS_NOT_READY");
    return LaboratoryProfileSchema.parse({
      ...result.rows[0],
      revision: Number(result.rows[0]!.revision),
    });
  }
  return {
    read: async (actor: Actor) =>
      database.transaction(async (tx) =>
        (await authorize(tx, actor, false)) ? profile(tx, false) : null,
      ),
    history: async (actor: Actor, before?: number) =>
      database.transaction(async (tx) => {
        if (!(await authorize(tx, actor, true))) return null;
        const result = await tx.query<{
          id: string;
          actor_id: string;
          revision: string;
          occurred_at: Date;
          previous: unknown;
          next: unknown;
        }>(
          "SELECT id,actor_id,aggregate_revision::text AS revision,occurred_at,previous_state AS previous,next_state AS next FROM public.laboratory_settings_events WHERE settings_id=$1 AND ($2::bigint IS NULL OR aggregate_revision<$2) ORDER BY aggregate_revision DESC LIMIT 51",
          [id, before ?? null],
        );
        const items = result.rows.slice(0, 50).map((row) => ({
          ...row,
          revision: Number(row.revision),
          occurred_at: row.occurred_at.toISOString(),
        }));
        return LaboratoryHistorySchema.parse({
          items,
          next_before: result.rows.length > 50 ? items[49]!.revision : null,
        });
      }),
    async update(actor: Actor, raw: unknown) {
      const parsed = LaboratoryUpdateSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return database.transaction(async (tx) => {
        if (!(await authorize(tx, actor, true)))
          return { kind: "denied" as const };
        const previous = await profile(tx, true),
          command = parsed.data;
        if (previous.revision !== command.expected_revision)
          return { kind: "conflict" as const };
        if (JSON.stringify(previous.fields) === JSON.stringify(command.fields))
          return { kind: "applied" as const };
        const revision = previous.revision + 1;
        if (!Number.isSafeInteger(revision))
          throw new Error("SETTINGS_REVISION_EXHAUSTED");
        const changed = await tx.query(
          "UPDATE public.laboratory_public_settings SET fields=$2::jsonb,revision=revision+1,changed_by=$3,changed_at=clock_timestamp() WHERE id=$1 AND revision=$4 RETURNING id",
          [
            id,
            JSON.stringify(command.fields),
            actor.accountId,
            previous.revision,
          ],
        );
        if (changed.rows.length !== 1) throw new Error("SETTINGS_WRITE_FAILED");
        const correlation = currentRequestCorrelation(),
          event = randomUUID();
        await tx.query(
          "INSERT INTO public.laboratory_settings_events(settings_id,actor_id,aggregate_revision,request_id,previous_state,next_state) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)",
          [
            id,
            actor.accountId,
            revision,
            correlation,
            previous.fields ? JSON.stringify(previous.fields) : null,
            JSON.stringify(command.fields),
          ],
        );
        await tx.query(
          "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision) VALUES($1,'LABORATORY_SETTINGS_UPDATED','settings',$2,$3,$4)",
          [actor.accountId, id, correlation, revision],
        );
        await tx.query(
          "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,actor_id,correlation_id) VALUES($1,'settings_changed','settings',$2,$3,$4,$5)",
          [event, id, revision, actor.accountId, correlation],
        );
        await tx.query(
          "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
          [event],
        );
        return { kind: "applied" as const };
      });
    },
  };
}
export async function assertLaboratorySettingsReady(
  database: DatabaseExecutor,
) {
  const result = await database.query<{ ready: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM public.laboratory_public_settings WHERE id='86000000-0000-4000-8000-000000000001') AND has_table_privilege(current_user,'public.laboratory_public_settings','SELECT') AND has_column_privilege(current_user,'public.laboratory_public_settings','fields','UPDATE') AND has_column_privilege(current_user,'public.laboratory_public_settings','revision','UPDATE') AND has_column_privilege(current_user,'public.laboratory_public_settings','changed_by','UPDATE') AND has_column_privilege(current_user,'public.laboratory_public_settings','changed_at','UPDATE') AND NOT has_table_privilege(current_user,'public.laboratory_public_settings','DELETE,TRUNCATE,INSERT') AND has_table_privilege(current_user,'public.laboratory_settings_events','SELECT') AND has_table_privilege(current_user,'public.laboratory_settings_events','INSERT') AND NOT has_table_privilege(current_user,'public.laboratory_settings_events','UPDATE,DELETE,TRUNCATE') AS ready`,
  );
  if (result.rows[0]?.ready !== true)
    throw new Error("LABORATORY_SETTINGS_NOT_READY");
}
