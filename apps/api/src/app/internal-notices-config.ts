export function internalNoticesEnabled(env: NodeJS.ProcessEnv) {
  const value = env.DENTAL_LAB_INTERNAL_NOTICES_ENABLED;
  if (value === undefined || value === "false") return false;
  if (value !== "true" || env.DENTAL_LAB_REGISTRATION_ENABLED !== "true")
    throw new Error("INVALID_INTERNAL_NOTICES_CONFIG");
  if (
    (env.DENTAL_LAB_ORDER_SUBMISSION_ENABLED === "true" ||
      env.DENTAL_LAB_ORDER_REQUEST_ENABLED === "true" ||
      env.DENTAL_LAB_ORDER_EDIT_ENABLED === "true" ||
      env.DENTAL_LAB_ORDER_MODIFICATION_ENABLED === "true" ||
      env.DENTAL_LAB_RETOUCH_ENABLED === "true") &&
    (env.DENTAL_LAB_ORDER_TRACKING_ENABLED !== "true" ||
      env.DENTAL_LAB_ORDER_DECISION_ENABLED !== "true")
  )
    throw new Error("ORDER_NOTICES_DESTINATION_UNAVAILABLE");
  return true;
}
