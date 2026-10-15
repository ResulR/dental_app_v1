export function accountStateEnabled(env: NodeJS.ProcessEnv): boolean {
  const value = env.DENTAL_LAB_ACCOUNT_STATE_ENABLED;
  if (value === undefined || value === "false") return false;
  if (value !== "true" || env.DENTAL_LAB_AUTH_ENABLED !== "true")
    throw new Error("INVALID_ACCOUNT_STATE_CONFIG");
  return true;
}
