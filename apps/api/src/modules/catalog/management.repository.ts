import { randomUUID } from "node:crypto";
import {
  CatalogImpactsSchema,
  CatalogCreateSchema,
  CatalogEditSchema,
  CatalogManagedFieldsSchema,
  CatalogManagedProfileSchema,
  CatalogManagedPageSchema,
  CatalogHistorySchema,
} from "@dental-lab/contracts";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
import { currentRequestCorrelation } from "../../shared/request-correlation.js";
type Database = Pick<
  ReturnType<typeof createApplicationDatabase>,
  "transaction"
>;
type Actor = { accountId: string; sessionId: string };
type Profile = ReturnType<typeof CatalogManagedProfileSchema.parse>;
const selection =
  "SELECT r.id,r.kind,r.revision::text,e.label,e.is_active,r.use_state,r.forbidden_reason FROM public.catalog_references r LEFT JOIN public.catalog_entries e ON e.reference_id=r.id";
function project(row: Record<string, unknown>) {
  return CatalogManagedProfileSchema.parse({
    ...row,
    revision: Number(row.revision),
  });
}
function fields(row: Profile) {
  return CatalogManagedFieldsSchema.parse({
    label: row.label,
    is_active: row.is_active,
    use_state: row.use_state,
    forbidden_reason: row.forbidden_reason,
  });
}
export function createCatalogManagementRepository(database: Database) {
  async function authorize(tx: DatabaseExecutor, actor: Actor) {
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
    return (
      !!identity &&
      identity.profile !== "clinic" &&
      identity.permissions.includes("catalog.manage")
    );
  }
  async function target(tx: DatabaseExecutor, id: string) {
    await tx.query(
      "SELECT id FROM public.catalog_references WHERE id=$1 FOR UPDATE",
      [id],
    );
    const result = await tx.query(selection + " WHERE r.id=$1", [id]);
    return result.rows.length === 1 ? project(result.rows[0]!) : null;
  }
  async function record(
    tx: DatabaseExecutor,
    actor: Actor,
    operation: "create" | "update" | "remove" | "restrict",
    next: Profile,
    previous: Profile | null,
  ) {
    const correlation = currentRequestCorrelation(),
      event = randomUUID();
    await tx.query(
      "INSERT INTO public.catalog_change_events(reference_id,actor_id,operation,aggregate_revision,request_id,previous_state,next_state) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)",
      [
        next.id,
        actor.accountId,
        operation,
        next.revision,
        correlation,
        previous ? JSON.stringify(fields(previous)) : null,
        JSON.stringify(fields(next)),
      ],
    );
    await tx.query(
      "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,$2,'catalog_reference',$3,$4,$5,ARRAY['catalog_state'])",
      [
        actor.accountId,
        operation === "create"
          ? "CATALOG_CREATED"
          : operation === "remove"
            ? "CATALOG_REMOVED"
            : operation === "restrict"
              ? "CATALOG_RESTRICTED"
              : "CATALOG_UPDATED",
        next.id,
        correlation,
        next.revision,
      ],
    );
    await tx.query(
      "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,actor_id,correlation_id) VALUES($1,'catalog_changed','catalog_reference',$2,$3,$4,$5)",
      [event, next.id, next.revision, actor.accountId, correlation],
    );
    await tx.query(
      "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
      [event],
    );
  }
  return {
    async list(actor: Actor, after?: string) {
      return database.transaction(async (tx) => {
        if (!(await authorize(tx, actor))) return null;
        const result = await tx.query(
          selection +
            " WHERE ($1::uuid IS NULL OR r.id>$1) ORDER BY r.id LIMIT 51",
          [after ?? null],
        );
        const items = result.rows.slice(0, 50).map(project);
        return CatalogManagedPageSchema.parse({
          items,
          next_after: result.rows.length > 50 ? items[49]!.id : null,
        });
      });
    },
    async profile(actor: Actor, id: string) {
      return database.transaction(async (tx) =>
        (await authorize(tx, actor)) ? target(tx, id) : null,
      );
    },
    async create(actor: Actor, raw: unknown) {
      const parsed = CatalogCreateSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return database.transaction(async (tx) => {
        if (!(await authorize(tx, actor))) return { kind: "denied" as const };
        const id = randomUUID();
        const next: Profile = {
          id,
          kind: parsed.data.kind,
          label: parsed.data.label,
          is_active: true,
          use_state: "available",
          forbidden_reason: null,
          revision: 1,
        };
        await tx.query(
          "INSERT INTO public.catalog_references(id,kind,changed_by) VALUES($1,$2,$3)",
          [id, next.kind, actor.accountId],
        );
        await tx.query(
          "INSERT INTO public.catalog_entries(reference_id,label) VALUES($1,$2)",
          [id, next.label],
        );
        await record(tx, actor, "create", next, null);
        return { kind: "applied" as const, id };
      });
    },
    async change(actor: Actor, id: string, raw: unknown) {
      const parsed = CatalogEditSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return database.transaction(async (tx) => {
        if (!(await authorize(tx, actor))) return { kind: "denied" as const };
        const previous = await target(tx, id);
        if (!previous) return { kind: "denied" as const };
        const command = parsed.data;
        if (previous.revision !== command.expected_revision)
          return { kind: "conflict" as const };
        // No ordinary edit can clear, hide or replace a safety prohibition.
        if (previous.use_state === "forbidden")
          return { kind: "restricted" as const };
        if (command.operation === "restrict") {
          if (!Number.isSafeInteger(previous.revision + 1))
            throw new Error("CATALOG_REVISION_EXHAUSTED");
          // Every future order writer must lock referenced catalogue rows before
          // creating/changing versions or progressing status; no silent fallback.
          const affected = await tx.query<{
            id: string;
            clinic_id: string;
            status: string;
          }>(
            `SELECT o.id,o.clinic_id,o.status FROM public.orders o WHERE EXISTS(SELECT 1 FROM public.order_versions v JOIN public.catalog_reference_snapshots s ON s.id IN(v.material_snapshot_id,v.shade_snapshot_id,v.work_type_snapshot_id) WHERE v.order_id=o.id AND s.reference_id=$1) ORDER BY o.id LIMIT 1001 FOR UPDATE OF o`,
            [id],
          );
          if (affected.rows.length > 1000)
            throw new Error("CATALOG_IMPACT_CAPACITY_EXCEEDED");
          const changed = await tx.query(
            "UPDATE public.catalog_references SET use_state='forbidden',forbidden_reason=$2,revision=revision+1,changed_at=GREATEST(clock_timestamp(),created_at),changed_by=$3 WHERE id=$1 AND revision=$4 RETURNING id",
            [id, command.reason, actor.accountId, previous.revision],
          );
          if (changed.rows.length !== 1)
            throw new Error("CATALOG_WRITE_FAILED");
          for (const order of affected.rows)
            if (order.status !== "delivered")
              await tx.query(
                "INSERT INTO public.order_security_blocks(order_id,clinic_id,reference_id,reason,created_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(order_id,reference_id) WHERE cleared_at IS NULL DO NOTHING",
                [
                  order.id,
                  order.clinic_id,
                  id,
                  command.reason,
                  actor.accountId,
                ],
              );
          const next: Profile = {
            ...previous,
            use_state: "forbidden",
            forbidden_reason: command.reason,
            revision: previous.revision + 1,
          };
          await record(tx, actor, "restrict", next, previous);
          const owner = await tx.query<{ id: string }>(
            "SELECT a.id FROM public.owner_slot s JOIN public.accounts a ON a.id=s.account_id WHERE s.singleton=1 AND a.profile='owner'",
          );
          if (owner.rows.length !== 1)
            throw new Error("CATALOG_OWNER_ALERT_UNAVAILABLE");
          const alert = randomUUID();
          await tx.query(
            "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,actor_id,correlation_id) VALUES($1,'security_alert','catalog_reference',$2,$3,$4,$5)",
            [
              alert,
              id,
              next.revision,
              actor.accountId,
              currentRequestCorrelation(),
            ],
          );
          await tx.query(
            "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
            [alert],
          );
          await tx.query(
            "INSERT INTO public.internal_notifications(event_id,target_account_id) VALUES($1,$2)",
            [alert, owner.rows[0]!.id],
          );
          await tx.query(
            "INSERT INTO public.notification_deliveries(event_id,target_account_id,channel,purpose) VALUES($1,$2,'email','security')",
            [alert, owner.rows[0]!.id],
          );
          return { kind: "applied" as const, id };
        }
        if (previous.label === null) return { kind: "conflict" as const };
        const next: Profile =
          command.operation === "remove"
            ? {
                ...previous,
                label: null,
                is_active: null,
                revision: previous.revision + 1,
              }
            : {
                ...previous,
                label: command.label,
                is_active: command.is_active,
                use_state: command.use_state,
                revision: previous.revision + 1,
              };
        if (JSON.stringify(fields(previous)) === JSON.stringify(fields(next)))
          return { kind: "applied" as const, id };
        if (!Number.isSafeInteger(next.revision))
          throw new Error("CATALOG_REVISION_EXHAUSTED");
        const updated = await tx.query(
          "UPDATE public.catalog_references SET use_state=$2,revision=revision+1,changed_at=GREATEST(clock_timestamp(),created_at),changed_by=$3 WHERE id=$1 AND revision=$4 RETURNING id",
          [id, next.use_state, actor.accountId, previous.revision],
        );
        if (updated.rows.length !== 1) throw new Error("CATALOG_WRITE_FAILED");
        const entry =
          command.operation === "remove"
            ? await tx.query(
                "DELETE FROM public.catalog_entries WHERE reference_id=$1 RETURNING reference_id",
                [id],
              )
            : await tx.query(
                "UPDATE public.catalog_entries SET label=$2,is_active=$3 WHERE reference_id=$1 RETURNING reference_id",
                [id, next.label, next.is_active],
              );
        if (entry.rows.length !== 1)
          throw new Error("CATALOG_ENTRY_WRITE_FAILED");
        await record(tx, actor, command.operation, next, previous);
        return { kind: "applied" as const, id };
      });
    },
    async impacts(actor: Actor, id: string, after?: string) {
      return database.transaction(async (tx) => {
        if (!(await authorize(tx, actor))) return null;
        const identity =
          await createCurrentPermissionsRepository(tx).current(actor);
        if (identity?.profile !== "owner" || !(await target(tx, id)))
          return null;
        const result = await tx.query(
          `SELECT o.id,o.number::text,o.clinic_id,o.status FROM public.orders o WHERE ($2::uuid IS NULL OR o.id>$2) AND EXISTS(SELECT 1 FROM public.order_versions v JOIN public.catalog_reference_snapshots s ON s.id IN(v.material_snapshot_id,v.shade_snapshot_id,v.work_type_snapshot_id) WHERE v.order_id=o.id AND s.reference_id=$1) ORDER BY o.id LIMIT 51`,
          [id, after ?? null],
        );
        const items = result.rows.slice(0, 50);
        return CatalogImpactsSchema.parse({
          items,
          next_after: result.rows.length > 50 ? items[49]!.id : null,
        });
      });
    },
    async history(actor: Actor, id: string, before?: number) {
      return database.transaction(async (tx) => {
        if (!(await authorize(tx, actor)) || !(await target(tx, id)))
          return null;
        const result = await tx.query<{
          id: string;
          actor_id: string;
          revision: string;
          operation: string;
          occurred_at: Date;
          previous: unknown;
          next: unknown;
        }>(
          "SELECT id,actor_id,aggregate_revision::text AS revision,operation,occurred_at,previous_state AS previous,next_state AS next FROM public.catalog_change_events WHERE reference_id=$1 AND ($2::bigint IS NULL OR aggregate_revision<$2) ORDER BY aggregate_revision DESC LIMIT 51",
          [id, before ?? null],
        );
        const items = result.rows.slice(0, 50).map((row) => ({
          ...row,
          revision: Number(row.revision),
          occurred_at: row.occurred_at.toISOString(),
        }));
        return CatalogHistorySchema.parse({
          items,
          next_before: result.rows.length > 50 ? items[49]!.revision : null,
        });
      });
    },
  };
}
export async function assertCatalogManagementReady(database: DatabaseExecutor) {
  const result = await database.query<{ ready: boolean }>(
    `SELECT has_table_privilege(current_user,'public.catalog_change_events','SELECT') AND has_table_privilege(current_user,'public.catalog_change_events','INSERT') AND NOT has_table_privilege(current_user,'public.catalog_change_events','UPDATE,DELETE,TRUNCATE') AND has_table_privilege(current_user,'public.catalog_entries','DELETE') AND has_table_privilege(current_user,'public.catalog_entries','INSERT') AND has_table_privilege(current_user,'public.catalog_references','INSERT') AND has_column_privilege(current_user,'public.catalog_entries','label','UPDATE') AND has_column_privilege(current_user,'public.catalog_entries','is_active','UPDATE') AND has_column_privilege(current_user,'public.catalog_references','use_state','UPDATE') AND has_column_privilege(current_user,'public.catalog_references','revision','UPDATE') AND has_column_privilege(current_user,'public.catalog_references','forbidden_reason','UPDATE') AND has_table_privilege(current_user,'public.order_security_blocks','INSERT') AND has_column_privilege(current_user,'public.orders','status','UPDATE') AND has_table_privilege(current_user,'public.internal_notifications','INSERT') AND has_table_privilege(current_user,'public.notification_deliveries','INSERT') AS ready`,
  );
  if (result.rows[0]?.ready !== true)
    throw new Error("CATALOG_MANAGEMENT_NOT_READY");
}
