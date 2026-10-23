import { createOrderEditRepository } from "./edit.repository.js";
export function createOrderEditService(
  db: Parameters<typeof createOrderEditRepository>[0],
  internalNotices = false,
) {
  return createOrderEditRepository(db, internalNotices);
}
