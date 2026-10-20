import { createDeliveryPriorityRepository } from "./delivery-priority.repository.js";
export function createDeliveryPriorityService(
  db: Parameters<typeof createDeliveryPriorityRepository>[0],
) {
  return createDeliveryPriorityRepository(db);
}
