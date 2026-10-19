import { createLaboratoryLinkedWorkRepository } from "./laboratory.repository.js";
export function createLaboratoryLinkedWorkService(
  db: Parameters<typeof createLaboratoryLinkedWorkRepository>[0],
) {
  return createLaboratoryLinkedWorkRepository(db);
}
