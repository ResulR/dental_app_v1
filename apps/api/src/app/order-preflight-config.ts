export function orderPreflightEnabled(env: NodeJS.ProcessEnv): boolean {
  const value = env.DENTAL_LAB_ORDER_PREFLIGHT_ENABLED;
  if (value === undefined || value === "false") return false;
  if (
    value !== "true" ||
    env.DENTAL_LAB_AUTH_ENABLED !== "true" ||
    env.DENTAL_LAB_CATALOG_ENABLED !== "true"
  )
    throw new Error("INVALID_ORDER_PREFLIGHT_CONFIG");
  return true;
}
