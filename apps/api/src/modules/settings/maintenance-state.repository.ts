import { randomUUID } from "node:crypto";
import { MaintenanceCommandSchema } from "@dental-lab/contracts";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { currentRequestCorrelation } from "../../shared/request-correlation.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";

type Actor = { accountId: string; sessionId: string };
async function owner(tx: DatabaseExecutor, actor: Actor) {
  await tx.query("SELECT id FROM public.accounts WHERE id=$1 FOR SHARE", [
    actor.accountId,
  ]);
  await tx.query("LOCK TABLE public.account_grants IN SHARE MODE");
  await tx.query(
    "SELECT id FROM public.sessions WHERE id=$1 AND account_id=$2 FOR SHARE",
    [actor.sessionId, actor.accountId],
  );
  const identity = await createCurrentPermissionsRepository(tx).current(actor);
  return identity?.profile === "owner";
}
export function createMaintenanceStateRepository(
  db: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async notice(actor: Actor) {
      return db.transaction(async (tx) => {
        await tx.query("SELECT id FROM public.accounts WHERE id=$1 FOR SHARE", [
          actor.accountId,
        ]);
        await tx.query(
          "SELECT id FROM public.sessions WHERE id=$1 AND account_id=$2 FOR SHARE",
          [actor.sessionId, actor.accountId],
        );
        if (!(await createCurrentPermissionsRepository(tx).current(actor)))
          return null;
        const r = await tx.query(
          "SELECT active,message,planned_at,planned_message FROM public.maintenance_state WHERE id='86000000-0000-4000-8000-000000000002'",
        );
        if (r.rows.length !== 1)
          throw new Error("MAINTENANCE_STATE_UNAVAILABLE");
        return r.rows[0];
      });
    },
    async read(actor: Actor) {
      return db.transaction(async (tx) => {
        if (!(await owner(tx, actor))) return null;
        const r = await tx.query(
          "SELECT active,message,planned_at,planned_message,revision::text FROM public.maintenance_state WHERE id='86000000-0000-4000-8000-000000000002'",
        );
        if (r.rows.length !== 1)
          throw new Error("MAINTENANCE_STATE_UNAVAILABLE");
        return { ...r.rows[0], revision: Number(r.rows[0]!.revision) };
      });
    },
    async history(actor: Actor) {
      return db.transaction(async (tx) => {
        if (!(await owner(tx, actor))) return null;
        const r = await tx.query(
          "SELECT revision::text,actor_id,occurred_at,before_state,after_state FROM public.maintenance_events ORDER BY revision DESC LIMIT 50",
        );
        return r.rows;
      });
    },
    async update(actor: Actor, raw: unknown) {
      const parsed = MaintenanceCommandSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return db.transaction(
        async (tx) => {
          if (!(await owner(tx, actor))) return { kind: "denied" as const };
          const previous = await tx.query(
            "SELECT active,message,planned_at,planned_message,revision::text FROM public.maintenance_state WHERE id='86000000-0000-4000-8000-000000000002' FOR UPDATE",
          );
          if (previous.rows.length !== 1)
            throw new Error("MAINTENANCE_STATE_UNAVAILABLE");
          const row = previous.rows[0]!;
          if (Number(row.revision) !== parsed.data.expected_revision)
            return { kind: "conflict" as const };
          const after = {
            active: parsed.data.active,
            message: parsed.data.message,
            planned_at: parsed.data.planned_at,
            planned_message: parsed.data.planned_message,
          };
          const before = {
            active: row.active,
            message: row.message,
            planned_at:
              row.planned_at instanceof Date
                ? row.planned_at.toISOString()
                : row.planned_at,
            planned_message: row.planned_message,
          };
          if (JSON.stringify(before) === JSON.stringify(after))
            return { kind: "unchanged" as const };
          const revision = Number(row.revision) + 1;
          if (!Number.isSafeInteger(revision))
            throw new Error("MAINTENANCE_REVISION_EXHAUSTED");
          const changed = await tx.query(
            "UPDATE public.maintenance_state SET active=$1,message=$2,planned_at=$3::timestamptz,planned_message=$4,revision=$5,changed_by=$6,changed_at=clock_timestamp() WHERE id='86000000-0000-4000-8000-000000000002' AND revision=$7 RETURNING revision::text",
            [
              after.active,
              after.message,
              after.planned_at,
              after.planned_message,
              revision,
              actor.accountId,
              row.revision,
            ],
          );
          if (changed.rows.length !== 1)
            throw new Error("MAINTENANCE_WRITE_CONFLICT");
          const requestId = currentRequestCorrelation() ?? randomUUID();
          await tx.query(
            "INSERT INTO public.maintenance_events(revision,actor_id,request_id,before_state,after_state) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)",
            [
              revision,
              actor.accountId,
              requestId,
              JSON.stringify(before),
              JSON.stringify(after),
            ],
          );
          await tx.query(
            "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,'MAINTENANCE_CHANGED','settings',$2,$3,$4,ARRAY['maintenance'])",
            [
              actor.accountId,
              "86000000-0000-4000-8000-000000000002",
              requestId,
              revision,
            ],
          );
          return { kind: "applied" as const, revision };
        },
        { maintenanceControl: true },
      );
    },
  };
}
