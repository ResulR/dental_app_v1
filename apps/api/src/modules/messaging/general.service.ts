import { createGeneralMessagingRepository } from "./general.repository.js";
export const createGeneralMessagingService = createGeneralMessagingRepository;
export function createOrderMessagingService(
  db: Parameters<typeof createGeneralMessagingRepository>[0],
) {
  return createGeneralMessagingRepository(db, "order");
}
