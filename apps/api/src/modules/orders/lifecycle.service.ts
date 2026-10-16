import { createOrderLifecycleRepository } from "./lifecycle.repository.js";
import { createLifecycleContextRepository } from "./lifecycle-context.repository.js";
export function createOrderLifecycleService(
  db: Parameters<typeof createOrderLifecycleRepository>[0],
) {
  return {
    ...createOrderLifecycleRepository(db),
    ...createLifecycleContextRepository(db),
  };
}
