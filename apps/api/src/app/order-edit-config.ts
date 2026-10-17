export function orderEditEnabled(env: NodeJS.ProcessEnv) {
  const value = env.DENTAL_LAB_ORDER_EDIT_ENABLED;
  if (value === undefined || value === "false") return false;
  if (value !== "true" || env.DENTAL_LAB_ORDER_LIFECYCLE_ENABLED !== "true")
    throw new Error("INVALID_ORDER_EDIT_CONFIG");
  return true;
}
