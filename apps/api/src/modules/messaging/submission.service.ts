import { createMessageSubmissionRepository } from "./submission.repository.js";
export function createMessageSubmissionService(
  db: Parameters<typeof createMessageSubmissionRepository>[0],
  attachmentPolicy?: Parameters<typeof createMessageSubmissionRepository>[1],
) {
  return createMessageSubmissionRepository(db, attachmentPolicy);
}
