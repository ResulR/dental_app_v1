export function orderLifecycleEnabled(env: NodeJS.ProcessEnv): boolean {
  const value = env.DENTAL_LAB_ORDER_LIFECYCLE_ENABLED;
  if (value === undefined || value === "false") return false;
  if (value !== "true" || env.DENTAL_LAB_ORDER_DECISION_ENABLED !== "true")
    throw new Error("INVALID_ORDER_LIFECYCLE_CONFIG");
  return true;
}
