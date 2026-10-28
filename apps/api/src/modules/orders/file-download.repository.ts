import { z } from "zod";
import type { createApplicationDatabase } from "../../shared/database.js";
import { createCurrentPermissionsRepository } from "../permissions/index.js";
import { trackingAuthority } from "./tracking-auth.js";

// Internal receipt only. No HTTP route or binary response is composed here.
const Request = z.strictObject({
  order_id: z.uuid(),
  version_id: z.uuid(),
  file_id: z.uuid(),
});
export function createOrderFileDownloadRepository(
  db: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
) {
  return {
    async authorize(
      actor: { accountId: string; sessionId: string },
      raw: unknown,
    ) {
      const parsed = Request.safeParse(raw);
      if (!parsed.success) return { kind: "invalid" as const };
      return db.transaction(async (tx) => {
        const auth = await trackingAuthority(tx, actor);
        if (!auth?.details) return { kind: "denied" as const };
        // Clinic self-access is intrinsic; staff needs a distinct current
        // download grant, independent of files.view and order detail access.
        if (auth.clinicId === null) {
          const current =
            await createCurrentPermissionsRepository(tx).current(actor);
          if (!current?.permissions.includes("files.download"))
            return { kind: "denied" as const };
        }
        const input = parsed.data;
        const rows = await tx.query<{
          object_key: string;
          size_bytes: string;
          sha256: string;
        }>(
          `SELECT f.object_key,f.size_bytes::text,
                  encode(f.content_sha256,'hex') AS sha256
             FROM public.orders o
             JOIN public.order_version_files b
               ON b.order_id=o.id AND b.clinic_id=o.clinic_id
                  AND b.version_id=o.current_version_id
             JOIN public.file_objects f
               ON f.id=b.file_id AND f.clinic_id=b.clinic_id
             JOIN public.upload_sessions u
               ON u.file_id=f.id AND u.clinic_id=f.clinic_id
            WHERE o.id=$1 AND o.current_version_id=$2 AND b.file_id=$3
              AND ($4::uuid IS NULL OR o.clinic_id=$4)
              AND f.state='ready' AND f.verified_at IS NOT NULL
              AND f.media_type_verified IS NOT NULL AND f.content_sha256 IS NOT NULL
              AND u.state='ready'
            FOR SHARE OF o,b,f,u`,
          [input.order_id, input.version_id, input.file_id, auth.clinicId],
        );
        if (
          rows.rows.length !== 1 ||
          !/^[0-9a-f]{64}$/.test(rows.rows[0]!.object_key) ||
          !/^[0-9a-f]{64}$/.test(rows.rows[0]!.sha256) ||
          !Number.isSafeInteger(Number(rows.rows[0]!.size_bytes))
        )
          return { kind: "denied" as const };
        return {
          kind: "authorized" as const,
          // Never serialize this receipt into an HTTP response.
          receipt: {
            objectKey: rows.rows[0]!.object_key,
            sizeBytes: Number(rows.rows[0]!.size_bytes),
            sha256: rows.rows[0]!.sha256,
          },
        };
      });
    },
  };
}
