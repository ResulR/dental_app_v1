import { createCatalogManagementRepository } from "./management.repository.js";
export function createCatalogManagementService(
  database: Parameters<typeof createCatalogManagementRepository>[0],
) {
  return createCatalogManagementRepository(database);
}
