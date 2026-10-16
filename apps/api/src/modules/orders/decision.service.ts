import { createOrderDecisionRepository } from "./decision.repository.js";
export function createOrderDecisionService(
  database: Parameters<typeof createOrderDecisionRepository>[0],
) {
  return createOrderDecisionRepository(database);
}
