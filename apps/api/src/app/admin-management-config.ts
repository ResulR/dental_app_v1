export function adminManagementEnabled(env: NodeJS.ProcessEnv): boolean {
  const value = env.DENTAL_LAB_ADMIN_MANAGEMENT_ENABLED;
  if (value === undefined || value === "false") return false;
  if (value !== "true" || env.DENTAL_LAB_AUTH_ENABLED !== "true")
    throw new Error("INVALID_ADMIN_MANAGEMENT_CONFIG");
  return true;
}
