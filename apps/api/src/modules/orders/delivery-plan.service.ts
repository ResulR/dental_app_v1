import { createDeliveryPlanRepository } from "./delivery-plan.repository.js";
export function createDeliveryPlanService(
  db: Parameters<typeof createDeliveryPlanRepository>[0],
) {
  return createDeliveryPlanRepository(db);
}
