import { randomUUID } from "node:crypto";
import {
  OrderModificationDecisionSchema,
  OrderModificationContextSchema,
  OrderLifecycleContextQuerySchema,
  OrderEditResultSchema,
  OrderInstructionsSchema,
} from "@dental-lab/contracts";
import type { createApplicationDatabase } from "../../shared/database.js";
import { readCatalogForUse } from "../catalog/index.js";
import { editAuthority } from "./edit-auth.js";
import { readEditVersion, editableInput } from "./edit-version.js";
import { createOrderEditRepository } from "./edit.repository.js";
type Actor = { accountId: string; sessionId: string };
export function createOrderModificationRepository(
  db: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
  internalNotices = false,
) {
  const result = (value: unknown) => ({
    kind: "result" as const,
    result: OrderEditResultSchema.parse(value),
  });
  return {
    async propose(actor: Actor, raw: unknown) {
      try {
        return await createOrderEditRepository(db, internalNotices).decide(
          actor,
          raw,
          true,
        );
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23505" &&
          "constraint" in error &&
          error.constraint === "order_requests_one_pending_idx"
        )
          return result({ kind: "blocked", reason: "pending_request" });
        throw error;
      }
    },
    async context(actor: Actor, raw: unknown) {
      const parsed = OrderLifecycleContextQuerySchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return db.transaction(async (tx) => {
        const editor = createOrderEditRepository({
          transaction: async (fn) => fn(tx),
        });
        const base = await editor.context(actor, parsed.data);
        if (base.kind !== "result") return base;
        const rows = await tx.query(
          "SELECT id,proposed_version_id,revision::text FROM public.order_requests WHERE order_id=$1 AND kind='modification' AND state='pending'",
          [parsed.data.order_id],
        );
        if (rows.rows.length !== 1) return { kind: "denied" as const };
        const request = rows.rows[0]!;
        const proposal = await editor.context(actor, {
          ...parsed.data,
          version_id: request.proposed_version_id,
        });
        if (proposal.kind !== "result") return proposal;
        return {
          kind: "result" as const,
          result: OrderModificationContextSchema.parse({
            base: base.result,
            proposal: proposal.result,
            request_id: request.id,
            request_revision: Number(request.revision),
          }),
        };
      });
    },
    async decide(actor: Actor, raw: unknown) {
      const parsed = OrderModificationDecisionSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      const command = parsed.data;
      return db.transaction(async (tx) => {
        const auth = await editAuthority(tx, actor);
        if (!auth || auth.clinic) return { kind: "denied" as const };
        // Read immutable proposal first, acquire catalogue locks before the aggregate.
        const initial = await tx.query(
          "SELECT proposed_version_id FROM public.order_requests WHERE id=$1 AND order_id=$2 AND kind='modification' AND state='pending'",
          [command.request_id, command.order_id],
        );
        if (initial.rows.length !== 1) return result({ kind: "conflict" });
        const proposedId = initial.rows[0]!.proposed_version_id;
        let unavailable = false;
        if (command.action === "accept_modification") {
          const version = await readEditVersion(
            tx,
            command.order_id,
            proposedId,
          );
          if (!version) throw new Error("MODIFICATION_VERSION_MISSING");
          if (version.file_count !== 0)
            return result({ kind: "blocked", reason: "files_not_ready" });
          const input = OrderInstructionsSchema.safeParse(
            editableInput(version),
          );
          if (!input.success)
            return result({ kind: "blocked", reason: "catalog_missing" });
          const catalog = await readCatalogForUse(tx, input.data);
          if (
            catalog.missing ||
            catalog.references.some((r) => !r.label?.trim())
          )
            return result({ kind: "blocked", reason: "catalog_missing" });
          if (catalog.references.some((r) => r.state === "forbidden"))
            return result({ kind: "blocked", reason: "catalog_forbidden" });
          unavailable = catalog.references.some(
            (r) => r.state === "unavailable",
          );
        }
        const rows = await tx.query(
          "SELECT id,clinic_id,status,current_version_id,manufacturing_version_id,revision::text FROM public.orders WHERE id=$1 FOR UPDATE",
          [command.order_id],
        );
        const order = rows.rows[0];
        if (
          !order ||
          order.status !== "accepted" ||
          order.manufacturing_version_id !== null ||
          order.current_version_id !== command.expected_version_id ||
          Number(order.revision) !== command.expected_revision
        )
          return result({ kind: "conflict" });
        const pending = await tx.query(
          "SELECT id,base_version_id,proposed_version_id,revision::text FROM public.order_requests WHERE order_id=$1 AND kind='modification' AND state='pending' FOR UPDATE",
          [order.id],
        );
        const request = pending.rows[0];
        if (
          pending.rows.length !== 1 ||
          !request ||
          request.id !== command.request_id ||
          request.proposed_version_id !== proposedId ||
          request.base_version_id !== order.current_version_id ||
          Number(request.revision) !== command.expected_request_revision
        )
          return result({ kind: "conflict" });
        if (command.action === "accept_modification") {
          if (
            (
              await tx.query(
                "SELECT id FROM public.order_security_blocks WHERE order_id=$1 AND cleared_at IS NULL LIMIT 1",
                [order.id],
              )
            ).rows.length
          )
            return result({ kind: "blocked", reason: "security_block" });
          if (unavailable && !command.confirmed_warnings)
            return result({ kind: "confirmation_required" });
        }
        const accepted = command.action === "accept_modification",
          versionId = accepted ? proposedId : order.current_version_id,
          revision = Number(order.revision) + 1,
          eventId = randomUUID(),
          correlation = randomUUID();
        if (
          (
            await tx.query(
              "UPDATE public.order_requests SET state=$2,decided_by=$3,decided_at=clock_timestamp(),decision_reason=$4,revision=revision+1 WHERE id=$1 AND state='pending' AND revision=$5 RETURNING id",
              [
                request.id,
                accepted ? "accepted" : "rejected",
                actor.accountId,
                command.action === "reject_modification"
                  ? command.reason
                  : null,
                command.expected_request_revision,
              ],
            )
          ).rows.length !== 1
        )
          throw new Error("MODIFICATION_REQUEST_CONFLICT");
        if (
          (
            await tx.query(
              "UPDATE public.orders SET current_version_id=$2,revision=revision+1 WHERE id=$1 AND revision=$3 RETURNING id",
              [order.id, versionId, command.expected_revision],
            )
          ).rows.length !== 1
        )
          throw new Error("MODIFICATION_AGGREGATE_CONFLICT");
        // One request_decided event drives notifications; avoid duplicate instructions_changed e-mails.
        await tx.query(
          "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,actor_id,correlation_id) VALUES($1,'request_decided','order',$2,$3,$4,$5,$6)",
          [
            eventId,
            order.id,
            revision,
            order.clinic_id,
            actor.accountId,
            correlation,
          ],
        );
        await tx.query(
          "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
          [eventId],
        );
        await tx.query(
          "INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id,aggregate_revision,changed_fields) VALUES($1,$2,'order',$3,$4,$5,$6::text[])",
          [
            actor.accountId,
            accepted ? "MODIFICATION_ACCEPTED" : "MODIFICATION_REJECTED",
            order.id,
            correlation,
            revision,
            accepted ? ["request", "version"] : ["request"],
          ],
        );
        return result({
          kind: "updated",
          order_id: order.id,
          version_id: versionId,
          revision,
          status: order.status,
        });
      });
    },
  };
}
