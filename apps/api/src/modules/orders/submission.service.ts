import { createOrderSubmissionRepository } from "./submission.repository.js";
export function createOrderSubmissionService(
  database: Parameters<typeof createOrderSubmissionRepository>[0],
) {
  return createOrderSubmissionRepository(database);
}
