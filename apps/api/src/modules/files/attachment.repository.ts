import type { DatabaseExecutor } from "../../shared/database.js";
import { assertAttachmentLimits } from "./transfer-limits.js";
// Server composition only. Not an HTTP input or proof that a provider is ready.
// Runtime deliberately supplies no policy until independent operational reception.
export type AttachmentPolicy = {
  storagePolicyVersion: string;
  capacityPolicyVersion: string;
};
type Scope = {
  actorId: string;
  clinicId: string;
  fileIds: readonly string[];
  purpose: "initial_order" | "retouch";
  sourceOrderId: string | null;
};
// Caller holds live account/session/clinic authorization and any source-order lock.
// Lock order: business aggregate, sorted file objects, sorted upload sessions.
// No filesystem operation or commit is performed inside this module.
export async function prepareNewOrderFiles(
  tx: DatabaseExecutor,
  scope: Scope,
  policy?: AttachmentPolicy,
) {
  if (!scope.fileIds.length) return { attach: async () => {} };
  if (
    !policy?.storagePolicyVersion.trim() ||
    !policy.capacityPolicyVersion.trim()
  )
    return null;
  const ids = [...scope.fileIds].sort();
  if (new Set(ids).size !== ids.length) return null;
  const files = await tx.query(
    `SELECT id,clinic_id,created_by,state,size_bytes::text,content_sha256,
      media_type_verified,verified_at,storage_policy_version
      FROM public.file_objects
      WHERE id=ANY($1::uuid[]) AND clinic_id=$2 AND created_by=$3
      ORDER BY id FOR UPDATE`,
    [ids, scope.clinicId, scope.actorId],
  );
  if (files.rows.length !== ids.length) return null;
  for (const row of files.rows) {
    if (
      !ids.includes(row.id) ||
      row.clinic_id !== scope.clinicId ||
      row.created_by !== scope.actorId ||
      row.state !== "ready" ||
      row.storage_policy_version !== policy.storagePolicyVersion ||
      !Buffer.isBuffer(row.content_sha256) ||
      row.content_sha256.length !== 32 ||
      !row.verified_at ||
      !row.media_type_verified?.trim()
    )
      return null;
  }
  try {
    assertAttachmentLimits(
      scope.purpose,
      files.rows.map((row) => ({
        id: row.id as string,
        sizeBytes: Number(row.size_bytes),
      })),
    );
  } catch {
    return null;
  }
  const sessions = await tx.query(
    `SELECT id,file_id,revision::text,declared_size::text,received_bytes::text
      FROM public.upload_sessions
      WHERE file_id=ANY($1::uuid[]) AND clinic_id=$2 AND account_id=$3
        AND intended_kind='initial_order'
        AND intended_order_id IS NOT DISTINCT FROM $4::uuid
        AND intended_conversation_id IS NULL
        AND state='ready' AND expires_at>statement_timestamp()
        AND capacity_policy_version=$5 AND received_bytes=declared_size
      ORDER BY id FOR UPDATE`,
    [
      ids,
      scope.clinicId,
      scope.actorId,
      scope.sourceOrderId,
      policy.capacityPolicyVersion,
    ],
  );
  if (
    sessions.rows.length !== ids.length ||
    new Set(sessions.rows.map((r) => r.file_id)).size !== ids.length
  )
    return null;
  for (const session of sessions.rows) {
    const file = files.rows.find((f) => f.id === session.file_id);
    if (
      !file ||
      Number(session.declared_size) !== Number(file.size_bytes) ||
      Number(session.received_bytes) !== Number(file.size_bytes)
    )
      return null;
  }
  // New uploads only. Historical reuse requires a separate authorized copy path;
  // file knowledge alone never permits copying another work's attachments.
  const bound = await tx.query(
    `SELECT file_id FROM public.order_version_files WHERE file_id=ANY($1::uuid[])
      UNION ALL SELECT file_id FROM public.message_version_files WHERE file_id=ANY($1::uuid[])
      UNION ALL SELECT file_id FROM public.order_followup_files WHERE file_id=ANY($1::uuid[])
      LIMIT 1`,
    [ids],
  );
  if (bound.rows.length) return null;
  let used = false;
  return {
    async attach(orderId: string, versionId: string) {
      if (used) throw new Error("ATTACHMENT_PLAN_ALREADY_USED");
      used = true;
      for (const session of sessions.rows) {
        const claimed = await tx.query(
          `UPDATE public.upload_sessions SET intended_order_id=$1,revision=revision+1
            WHERE id=$2 AND revision=$3 AND state='ready'
              AND expires_at>statement_timestamp() RETURNING id`,
          [orderId, session.id, session.revision],
        );
        if (claimed.rows.length !== 1)
          throw new Error("ATTACHMENT_SESSION_CONFLICT");
      }
      for (const fileId of ids) {
        await tx.query(
          "INSERT INTO public.order_version_files(version_id,order_id,clinic_id,file_id,attached_by) VALUES($1,$2,$3,$4,$5)",
          [versionId, orderId, scope.clinicId, fileId, scope.actorId],
        );
        await tx.query(
          "INSERT INTO public.file_events(file_id,actor_id,action) VALUES($1,$2,'attached_to_order')",
          [fileId, scope.actorId],
        );
      }
    },
  };
}
