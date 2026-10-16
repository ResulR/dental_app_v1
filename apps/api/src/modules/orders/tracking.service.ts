import { createOrderTrackingRepository } from "./tracking.repository.js";
import type { OrderTrackingRepository } from "./tracking.repository.js";
export function createOrderTrackingService(
  db: Parameters<typeof createOrderTrackingRepository>[0],
): OrderTrackingRepository {
  return createOrderTrackingRepository(db);
}
