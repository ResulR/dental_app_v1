import { createCancellationRequestRepository } from "./cancellation-request.repository.js";
export function createCancellationRequestService(
  db: Parameters<typeof createCancellationRequestRepository>[0],
  internalNotices = false,
) {
  return createCancellationRequestRepository(db, internalNotices);
}
