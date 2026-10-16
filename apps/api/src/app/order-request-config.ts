export function orderRequestEnabled(env: NodeJS.ProcessEnv) {
  const value = env.DENTAL_LAB_ORDER_REQUEST_ENABLED;
  if (value === undefined || value === "false") return false;
  if (value !== "true" || env.DENTAL_LAB_ORDER_LIFECYCLE_ENABLED !== "true")
    throw new Error("INVALID_ORDER_REQUEST_CONFIG");
  return true;
}
