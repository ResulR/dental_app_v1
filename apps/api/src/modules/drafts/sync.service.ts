import { createHash } from "node:crypto";
import {
  DraftListQuerySchema,
  DraftMutationSchema,
  DraftQuerySchema,
} from "@dental-lab/contracts";
import type { createApplicationDatabase } from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
import { createDraftRepository } from "./drafts.repository.js";

type Database = Pick<
  ReturnType<typeof createApplicationDatabase>,
  "transaction"
>;
type Actor = { accountId: string; sessionId: string };

export function createDraftSyncService(database: Database) {
  async function authorized<T>(
    actor: Actor,
    work: (
      tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
      clinicId: string,
    ) => Promise<T>,
  ) {
    return database.transaction(async (tx) => {
      await tx.query("SELECT id FROM public.accounts WHERE id=$1 FOR UPDATE", [
        actor.accountId,
      ]);
      await tx.query(
        "SELECT id FROM public.sessions WHERE id=$1 AND account_id=$2 FOR SHARE",
        [actor.sessionId, actor.accountId],
      );
      const identity =
        await createCurrentPermissionsRepository(tx).current(actor);
      if (identity?.profile !== "clinic") return { kind: "denied" as const };
      const clinics = await tx.query<{ id: string }>(
        "SELECT id FROM public.clinics WHERE account_id=$1 AND review_state='approved' AND NOT suspended FOR SHARE",
        [actor.accountId],
      );
      if (clinics.rows.length !== 1) return { kind: "denied" as const };
      return {
        kind: "result" as const,
        value: await work(tx, clinics.rows[0]!.id),
      };
    });
  }
  return {
    async list(actor: Actor, raw: unknown) {
      const parsed = DraftListQuerySchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return authorized(actor, async (tx, clinicId) => {
        const result = await tx.query<{ draft_id: string; revision: string }>(
          `SELECT id AS draft_id,revision::text FROM public.drafts
           WHERE account_id=$1 AND clinic_id=$2 AND state='active'
             AND ($3::uuid IS NULL OR id>$3::uuid)
           ORDER BY id LIMIT 51`,
          [actor.accountId, clinicId, parsed.data.after ?? null],
        );
        const items = result.rows.slice(0, 50);
        return {
          items,
          next_after: result.rows.length > 50 ? items.at(-1)!.draft_id : null,
        };
      });
    },
    async read(actor: Actor, raw: unknown) {
      const parsed = DraftQuerySchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return authorized(actor, async (tx, clinicId) => {
        const result = await tx.query<{
          draft_id: string;
          revision: string;
          state: string;
          payload: Record<string, unknown> | null;
        }>(
          `SELECT d.id AS draft_id,d.revision::text AS revision,d.state,r.payload
          FROM public.drafts d LEFT JOIN public.draft_revisions r
          ON r.draft_id=d.id AND r.revision=d.revision
          WHERE d.id=$1 AND d.account_id=$2 AND d.clinic_id=$3`,
          [parsed.data.draft_id, actor.accountId, clinicId],
        );
        const row = result.rows[0];
        return row
          ? {
              draft_id: row.draft_id,
              revision: row.revision,
              state: row.state,
              payload: row.state === "active" ? row.payload : null,
            }
          : null;
      });
    },
    async commit(actor: Actor, raw: unknown) {
      const parsed = DraftMutationSchema.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      const input = parsed.data;
      const action = input.payload ? "save" : "delete";
      if (
        (!input.payload && input.expected_revision === 0) ||
        JSON.stringify(input.payload ?? {}).length > 65_536
      )
        return { kind: "invalid" as const };
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify([
            input.draft_id,
            input.expected_revision,
            action,
            input.payload ?? null,
          ]),
        )
        .digest();
      return authorized(actor, async (tx, clinicId) => {
        const prior = await tx.query<{
          draft_id: string;
          committed_revision: string;
          payload_fingerprint: Buffer;
        }>(
          `SELECT draft_id,committed_revision::text,payload_fingerprint
           FROM public.draft_sync_receipts WHERE account_id=$1 AND clinic_id=$2 AND idempotency_key=$3`,
          [actor.accountId, clinicId, input.idempotency_key],
        );
        if (prior.rows.length) {
          const row = prior.rows[0]!;
          return row.draft_id === input.draft_id &&
            Buffer.isBuffer(row.payload_fingerprint) &&
            row.payload_fingerprint.equals(fingerprint)
            ? {
                kind: "committed" as const,
                revision: row.committed_revision,
                replayed: true,
              }
            : { kind: "conflict" as const };
        }
        if (input.expected_revision === 0) {
          const created = await tx.query<{ revision: string }>(
            `
            WITH draft AS (
              INSERT INTO public.drafts(id,account_id,clinic_id)
              VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id,account_id,clinic_id,revision
            ), revision AS (
              INSERT INTO public.draft_revisions(draft_id,account_id,clinic_id,revision,schema_version,payload)
              SELECT id,account_id,clinic_id,revision,1,$4::jsonb FROM draft
              RETURNING draft_id,account_id,clinic_id,revision
            )
            INSERT INTO public.draft_sync_receipts(account_id,clinic_id,draft_id,committed_revision,action,idempotency_key,payload_fingerprint)
            SELECT account_id,clinic_id,draft_id,revision,'save',$5,$6 FROM revision
            RETURNING committed_revision::text AS revision`,
            [
              input.draft_id,
              actor.accountId,
              clinicId,
              JSON.stringify(input.payload),
              input.idempotency_key,
              fingerprint,
            ],
          );
          return created.rows[0]
            ? {
                kind: "committed" as const,
                revision: created.rows[0].revision,
                replayed: false,
              }
            : { kind: "conflict" as const };
        }
        if (input.payload) {
          const saved = await createDraftRepository(tx).save({
            draftId: input.draft_id,
            accountId: actor.accountId,
            clinicId,
            expectedRevision: input.expected_revision,
            schemaVersion: 1,
            payload: input.payload,
            idempotencyKey: input.idempotency_key,
            payloadFingerprint: fingerprint,
          });
          return saved
            ? {
                kind: "committed" as const,
                revision: saved.revision,
                replayed: false,
              }
            : { kind: "conflict" as const };
        }
        const deleted = await tx.query<{ revision: string }>(
          `
          WITH changed AS (
            UPDATE public.drafts SET revision=revision+1,state='deleted',
              deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
            WHERE id=$1 AND account_id=$2 AND clinic_id=$3 AND revision=$4 AND state='active'
            RETURNING id,account_id,clinic_id,revision
          ), history AS (
            INSERT INTO public.draft_revisions(draft_id,account_id,clinic_id,revision,schema_version,payload)
            SELECT c.id,c.account_id,c.clinic_id,c.revision,r.schema_version,r.payload
            FROM changed c JOIN public.draft_revisions r ON r.draft_id=c.id AND r.revision=c.revision-1
            RETURNING draft_id,account_id,clinic_id,revision
          )
          INSERT INTO public.draft_sync_receipts(account_id,clinic_id,draft_id,committed_revision,action,idempotency_key,payload_fingerprint)
          SELECT account_id,clinic_id,draft_id,revision,'delete',$5,$6 FROM history
          RETURNING committed_revision::text AS revision`,
          [
            input.draft_id,
            actor.accountId,
            clinicId,
            input.expected_revision,
            input.idempotency_key,
            fingerprint,
          ],
        );
        return deleted.rows[0]
          ? {
              kind: "committed" as const,
              revision: deleted.rows[0].revision,
              replayed: false,
            }
          : { kind: "conflict" as const };
      });
    },
  };
}
