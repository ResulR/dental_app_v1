export function orderTrackingEnabled(env: NodeJS.ProcessEnv) {
  const value = env.DENTAL_LAB_ORDER_TRACKING_ENABLED;
  if (value === undefined || value === "false") return false;
  if (value !== "true" || env.DENTAL_LAB_ORDER_SUBMISSION_ENABLED !== "true")
    throw new Error("INVALID_ORDER_TRACKING_CONFIG");
  return true;
}
