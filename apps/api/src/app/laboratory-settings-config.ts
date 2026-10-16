export function laboratorySettingsEnabled(env: NodeJS.ProcessEnv): boolean {
  const value = env.DENTAL_LAB_LABORATORY_SETTINGS_ENABLED;
  if (value === undefined || value === "false") return false;
  if (value !== "true" || env.DENTAL_LAB_AUTH_ENABLED !== "true")
    throw new Error("INVALID_LABORATORY_SETTINGS_CONFIG");
  return true;
}
