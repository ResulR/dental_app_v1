export function orderMessagingEnabled(env: NodeJS.ProcessEnv) {
  const value = env.DENTAL_LAB_ORDER_MESSAGING_ENABLED;
  if (value === undefined || value === "false") return false;
  if (value !== "true" || env.DENTAL_LAB_GENERAL_MESSAGING_ENABLED !== "true")
    throw new Error("INVALID_ORDER_MESSAGING_CONFIG");
  return true;
}
