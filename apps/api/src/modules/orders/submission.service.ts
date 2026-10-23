import { createOrderSubmissionRepository } from "./submission.repository.js";
export function createOrderSubmissionService(
  database: Parameters<typeof createOrderSubmissionRepository>[0],
  attachmentPolicy?: Parameters<typeof createOrderSubmissionRepository>[1],
  internalNotices = false,
) {
  return createOrderSubmissionRepository(
    database,
    attachmentPolicy,
    internalNotices,
  );
}
