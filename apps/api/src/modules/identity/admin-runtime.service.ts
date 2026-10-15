import { createAdminRepository } from "./admin.repository.js";
export function createAdminRuntimeService(
  database: Parameters<typeof createAdminRepository>[0],
) {
  const store = createAdminRepository(database);
  return {
    list: store.list,
    profile: store.profile,
    history: store.history,
    change: store.change,
  };
}
