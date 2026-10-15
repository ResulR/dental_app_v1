export function delegationEnabled(env: NodeJS.ProcessEnv): boolean {
  const value = env.DENTAL_LAB_DELEGATION_ENABLED;
  if (value === undefined || value === "false") return false;
  if (value !== "true" || env.DENTAL_LAB_AUTH_ENABLED !== "true")
    throw new Error("INVALID_DELEGATION_CONFIG");
  return true;
}
