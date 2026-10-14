import { createHash } from "node:crypto";
import { RegistrationTermsSchema } from "@dental-lab/contracts";
import type { DatabaseExecutor } from "../../shared/database.js";

export function createRegistrationTermsRepository(database: DatabaseExecutor) {
  return {
    async current() {
      const result = await database.query<{
        version_id: string;
        body: string;
        body_sha256: Buffer;
        approved: boolean;
      }>(`SELECT v.id AS version_id,v.body,v.body_sha256,
        (v.locale='sq' AND btrim(v.approval_reference)<>'' AND
         v.approved_at <= CURRENT_TIMESTAMP) AS approved
        FROM public.registration_current_terms t
        JOIN public.registration_terms_versions v ON v.id=t.version_id
        WHERE t.singleton=1`);
      const row = result.rows[0];
      if (
        result.rows.length !== 1 ||
        !row ||
        row.approved !== true ||
        !Buffer.isBuffer(row.body_sha256) ||
        typeof row.body !== "string" ||
        Buffer.byteLength(row.body) > 1048576 ||
        !createHash("sha256").update(row.body).digest().equals(row.body_sha256)
      )
        return undefined;
      return RegistrationTermsSchema.parse({
        version_id: row.version_id,
        body: row.body,
        body_sha256: row.body_sha256.toString("hex"),
      });
    },
  };
}
