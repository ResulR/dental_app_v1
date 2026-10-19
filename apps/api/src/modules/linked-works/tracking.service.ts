import { createLinkedWorkTrackingRepository } from "./tracking.repository.js";
export function createLinkedWorkTrackingService(
  db: Parameters<typeof createLinkedWorkTrackingRepository>[0],
) {
  return createLinkedWorkTrackingRepository(db);
}
