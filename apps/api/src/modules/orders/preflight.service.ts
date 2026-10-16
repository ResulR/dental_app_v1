import { createOrderPreflightRepository } from "./preflight.repository.js";
export function createOrderPreflightService(
  database: Parameters<typeof createOrderPreflightRepository>[0],
) {
  return createOrderPreflightRepository(database);
}
