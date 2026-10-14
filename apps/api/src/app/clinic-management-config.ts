export function clinicManagementEnabled(env: NodeJS.ProcessEnv): boolean {
  const value = env.DENTAL_LAB_CLINIC_MANAGEMENT_ENABLED;
  if (value === undefined || value === "false") return false;
  if (value !== "true" || env.DENTAL_LAB_AUTH_ENABLED !== "true")
    throw new Error("INVALID_CLINIC_MANAGEMENT_CONFIG");
  return true;
}
