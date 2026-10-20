import { createActionInboxRepository } from "./action-inbox.repository.js";
export function createActionInboxService(
  db: Parameters<typeof createActionInboxRepository>[0],
) {
  return createActionInboxRepository(db);
}
