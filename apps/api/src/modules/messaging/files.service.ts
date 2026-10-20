import { createMessageFilesRepository } from "./files.repository.js";
export { MessageFilesQuerySchema } from "./files.repository.js";
export function createMessageFilesService(
  db: Parameters<typeof createMessageFilesRepository>[0],
) {
  return createMessageFilesRepository(db);
}
