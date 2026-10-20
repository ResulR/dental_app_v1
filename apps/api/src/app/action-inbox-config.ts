export function actionInboxEnabled(env: NodeJS.ProcessEnv) {
  const value = env.DENTAL_LAB_ACTION_INBOX_ENABLED;
  if (value === undefined || value === "false") return false;
  if (
    value !== "true" ||
    env.DENTAL_LAB_ORDER_MODIFICATION_ENABLED !== "true" ||
    env.DENTAL_LAB_CLINIC_MANAGEMENT_ENABLED !== "true"
  )
    throw new Error("INVALID_ACTION_INBOX_CONFIG");
  return true;
}
