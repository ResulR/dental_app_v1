export function laboratoryOrderEnabled(env: NodeJS.ProcessEnv) {
  const value = env.DENTAL_LAB_LABORATORY_ORDER_ENABLED;
  if (value === undefined || value === "false") return false;
  if (
    value !== "true" ||
    env.DENTAL_LAB_ORDER_SUBMISSION_ENABLED !== "true" ||
    env.DENTAL_LAB_INTERNAL_NOTICES_ENABLED !== "true" ||
    env.DENTAL_LAB_ORDER_TRACKING_ENABLED !== "true"
  )
    throw new Error("INVALID_LABORATORY_ORDER_CONFIG");
  return true;
}
