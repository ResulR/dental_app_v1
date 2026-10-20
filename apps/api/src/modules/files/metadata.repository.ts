import type { DatabaseExecutor } from "../../shared/database.js";
import { OrderFilesPageSchema } from "@dental-lab/contracts";
// Internal parent-authorized operation: caller holds current identity/grant/clinic
// and order locks and has checked files.view plus detailed parent access.
// Never return object keys, hashes or storage paths. No bytes are transferred.
export async function readOrderFileMetadata(
  tx: DatabaseExecutor,
  input: {
    orderId: string;
    versionId: string;
    clinicId: string;
    after?: string;
  },
) {
  const result = await tx.query(
    `SELECT f.id,f.filename_original AS filename,f.format,f.size_bytes::text
      FROM public.order_version_files b
      JOIN public.file_objects f ON f.id=b.file_id AND f.clinic_id=b.clinic_id
      WHERE b.order_id=$1 AND b.version_id=$2 AND b.clinic_id=$3
        AND f.state='ready' AND f.verified_at IS NOT NULL
        AND f.content_sha256 IS NOT NULL AND f.media_type_verified IS NOT NULL
        AND ($4::uuid IS NULL OR f.id>$4)
      ORDER BY f.id LIMIT 51 FOR SHARE OF f`,
    [input.orderId, input.versionId, input.clinicId, input.after ?? null],
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
