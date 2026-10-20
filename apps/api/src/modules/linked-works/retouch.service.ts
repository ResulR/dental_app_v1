import { createRetouchRepository } from "./retouch.repository.js";
import { RetouchSubmissionResultSchema } from "@dental-lab/contracts";
export function createRetouchService(
  db: Parameters<typeof createRetouchRepository>[0],
  attachmentPolicy?: Parameters<typeof createRetouchRepository>[1],
) {
  const repo = createRetouchRepository(db, attachmentPolicy);
  return {
    async submit(actor: Parameters<typeof repo.submit>[0], raw: unknown) {
      try {
        return await repo.submit(actor, raw);
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23505" &&
          "constraint" in error &&
          error.constraint === "work_links_one_active_retouch_idx"
        )
          return {
            kind: "result" as const,
            result: RetouchSubmissionResultSchema.parse({
              kind: "active_retouch",
              persisted: false,
            }),
          };
        throw error;
      }
    },
  };
}
