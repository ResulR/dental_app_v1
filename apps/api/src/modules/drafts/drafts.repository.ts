import type { createApplicationDatabase } from "../../shared/database.js";

type Database = Pick<ReturnType<typeof createApplicationDatabase>, "query">;
export type DraftSave = {
  draftId: string;
  accountId: string;
  clinicId: string;
  expectedRevision: number;
  schemaVersion: number;
  payload: Readonly<Record<string, unknown>>;
  idempotencyKey: string;
  payloadFingerprint: Uint8Array;
};

// Trusted service inputs only. No HTTP handler or connection is created here.
// CAS, revision append and receipt share one statement/transaction. A unique
// receipt conflict aborts the entire statement; the service must recover the
// committed receipt and compare its fingerprint before answering a retry.
const saveSql = `
WITH changed AS (
 UPDATE public.drafts
 SET revision=revision+1,updated_at=CURRENT_TIMESTAMP
 WHERE id=$1 AND account_id=$2 AND clinic_id=$3
   AND revision=$4 AND state='active'
 RETURNING id,account_id,clinic_id,revision
), history AS (
 INSERT INTO public.draft_revisions(draft_id,account_id,clinic_id,revision,schema_version,payload)
 SELECT id,account_id,clinic_id,revision,$5,$6::jsonb FROM changed
 RETURNING draft_id,account_id,clinic_id,revision
)
INSERT INTO public.draft_sync_receipts(account_id,clinic_id,draft_id,committed_revision,action,idempotency_key,payload_fingerprint)
SELECT account_id,clinic_id,draft_id,revision,'save',$7,$8 FROM history
RETURNING draft_id,committed_revision::text AS revision
`;

export function createDraftRepository(database: Database) {
  return {
    async save(
      input: DraftSave,
    ): Promise<{ draft_id: string; revision: string } | null> {
      if (
        !Number.isSafeInteger(input.expectedRevision) ||
        input.expectedRevision < 1 ||
        input.expectedRevision >= Number.MAX_SAFE_INTEGER ||
        !Number.isSafeInteger(input.schemaVersion) ||
        input.schemaVersion < 1 ||
        input.schemaVersion > 2147483647 ||
        input.payloadFingerprint.byteLength !== 32 ||
        input.idempotencyKey.trim().length === 0
      )
        throw new Error("INVALID_DRAFT_SAVE");
      const result = await database.query<{
        draft_id: string;
        revision: string;
      }>(saveSql, [
        input.draftId,
        input.accountId,
        input.clinicId,
        input.expectedRevision,
        input.schemaVersion,
        JSON.stringify(input.payload),
        input.idempotencyKey,
        Buffer.from(input.payloadFingerprint),
      ]);
      return result.rows[0] ?? null;
    },
  };
}
