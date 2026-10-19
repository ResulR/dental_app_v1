import { createOrderModificationRepository } from "./modification.repository.js";
export function createOrderModificationService(
  db: Parameters<typeof createOrderModificationRepository>[0],
) {
  return createOrderModificationRepository(db);
}
