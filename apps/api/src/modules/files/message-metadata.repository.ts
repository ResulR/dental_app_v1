import type { DatabaseExecutor } from "../../shared/database.js";
import { OrderFilesPageSchema } from "@dental-lab/contracts";
// The caller locks the authorized current message and scopes the clinic.
export async function readMessageFileMetadata(
  tx: DatabaseExecutor,
  input: {
    messageId: string;
    versionId: string;
    clinicId: string;
    after?: string;
  },
) {
  const result = await tx.query(
    `SELECT f.id,f.filename_original AS filename,f.format,f.size_bytes::text
      FROM public.message_version_files b
      JOIN public.file_objects f ON f.id=b.file_id AND f.clinic_id=b.clinic_id
      WHERE b.version_id=$1 AND b.clinic_id=$2
        AND f.state='ready' AND f.verified_at IS NOT NULL
        AND f.content_sha256 IS NOT NULL AND f.media_type_verified IS NOT NULL
        AND ($3::uuid IS NULL OR f.id>$3)
        AND EXISTS(SELECT 1 FROM public.message_versions v
          WHERE v.id=b.version_id AND v.message_id=$4 AND v.clinic_id=$2)
      ORDER BY f.id LIMIT 51 FOR SHARE OF f`,
    [input.versionId, input.clinicId, input.after ?? null, input.messageId],
  );
  return OrderFilesPageSchema.parse({
    version_id: input.versionId,
    items: result.rows.slice(0, 50).map((row) => ({
      id: row.id,
      filename: row.filename,
      format: row.format,
      size_bytes: Number(row.size_bytes),
    })),
    next_after: result.rows.length > 50 ? result.rows[49]!.id : null,
    download_available: false,
  });
}
