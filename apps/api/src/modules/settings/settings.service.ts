import { createLaboratorySettingsRepository } from "./settings.repository.js";
export function createLaboratorySettingsService(
  database: Parameters<typeof createLaboratorySettingsRepository>[0],
) {
  return createLaboratorySettingsRepository(database);
}
