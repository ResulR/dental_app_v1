import type { DatabaseExecutor } from "../../shared/database.js";
import { assertAttachmentLimits } from "./transfer-limits.js";
import type { AttachmentPolicy } from "./attachment.repository.js";
// Caller must hold current actor/session authority and the conversation row lock.
// This checks only newly uploaded files for this exact conversation and actor.
// Never infer authority from knowledge of a file id.
export async function prepareMessageFiles(
  tx: DatabaseExecutor,
  input: {
    actorId: string;
    clinicId: string;
    conversationId: string;
    fileIds: readonly string[];
  },
  policy?: AttachmentPolicy,
) {
  if (!input.fileIds.length) return { attach: async () => {} };
  if (
    !policy?.storagePolicyVersion?.trim() ||
    !policy.capacityPolicyVersion?.trim()
  )
    return null;
  const ids = [...input.fileIds].sort();
  if (new Set(ids).size !== ids.length) return null;
  const files = await tx.query(
    `SELECT id,clinic_id,created_by,state,size_bytes::text,content_sha256,
      media_type_verified,verified_at,storage_policy_version
      FROM public.file_objects
      WHERE id=ANY($1::uuid[]) AND clinic_id=$2 AND created_by=$3
      ORDER BY id FOR UPDATE`,
    [ids, input.clinicId, input.actorId],
  );
  if (
    files.rows.length !== ids.length ||
    files.rows.some(
      (row) =>
        !ids.includes(row.id) ||
        row.clinic_id !== input.clinicId ||
        row.created_by !== input.actorId ||
        row.state !== "ready" ||
        row.storage_policy_version !== policy.storagePolicyVersion ||
        !Buffer.isBuffer(row.content_sha256) ||
        row.content_sha256.length !== 32 ||
        !row.verified_at ||
        !row.media_type_verified?.trim(),
    )
  )
    return null;
  try {
    assertAttachmentLimits(
      "message",
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
        AND intended_kind='message' AND intended_conversation_id=$4
        AND intended_order_id IS NULL
        AND state='ready' AND expires_at>statement_timestamp()
        AND capacity_policy_version=$5 AND received_bytes=declared_size
      ORDER BY id FOR UPDATE`,
    [
      ids,
      input.clinicId,
      input.actorId,
      input.conversationId,
      policy.capacityPolicyVersion,
    ],
  );
  if (
    sessions.rows.length !== ids.length ||
    new Set(sessions.rows.map((row) => row.file_id)).size !== ids.length ||
    sessions.rows.some((row) => {
      const file = files.rows.find((file) => file.id === row.file_id);
      return (
        !file ||
        Number(row.declared_size) !== Number(file.size_bytes) ||
        Number(row.received_bytes) !== Number(file.size_bytes)
      );
    })
  )
    return null;
  // Under the file locks, reject implicit historical reuse in every parent category.
  const bound = await tx.query(
    `SELECT file_id FROM public.message_version_files WHERE file_id=ANY($1::uuid[])
      UNION ALL SELECT file_id FROM public.order_version_files WHERE file_id=ANY($1::uuid[])
      UNION ALL SELECT file_id FROM public.order_followup_files WHERE file_id=ANY($1::uuid[])
      LIMIT 1`,
    [ids],
  );
  if (bound.rows.length) return null;
  let used = false;
  return {
    async attach(versionId: string) {
      if (used) throw new Error("MESSAGE_ATTACHMENT_PLAN_ALREADY_USED");
      used = true;
      for (const session of sessions.rows) {
        const updated = await tx.query(
          `UPDATE public.upload_sessions SET revision=revision+1
            WHERE id=$1 AND revision=$2 AND state='ready'
              AND expires_at>statement_timestamp() RETURNING id`,
          [session.id, session.revision],
        );
        if (updated.rows.length !== 1)
          throw new Error("MESSAGE_ATTACHMENT_SESSION_CONFLICT");
      }
      for (const fileId of ids) {
        await tx.query(
          "INSERT INTO public.message_version_files(version_id,clinic_id,file_id) VALUES($1,$2,$3)",
          [versionId, input.clinicId, fileId],
        );
        await tx.query(
          "INSERT INTO public.file_events(file_id,actor_id,action) VALUES($1,$2,'attached_to_message')",
          [fileId, input.actorId],
        );
      }
    },
  };
}
