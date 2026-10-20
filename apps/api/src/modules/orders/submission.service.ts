import { createOrderSubmissionRepository } from "./submission.repository.js";
export function createOrderSubmissionService(
  database: Parameters<typeof createOrderSubmissionRepository>[0],
  attachmentPolicy?: Parameters<typeof createOrderSubmissionRepository>[1],
) {
  return createOrderSubmissionRepository(database, attachmentPolicy);
}
