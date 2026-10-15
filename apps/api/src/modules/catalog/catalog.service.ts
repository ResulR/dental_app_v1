import { createCatalogRepository } from "./catalog.repository.js";
export function createCatalogService(
  database: Parameters<typeof createCatalogRepository>[0],
) {
  return createCatalogRepository(database);
}
