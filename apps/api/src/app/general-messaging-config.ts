export function generalMessagingEnabled(env: NodeJS.ProcessEnv) {
  const value = env.DENTAL_LAB_GENERAL_MESSAGING_ENABLED;
  if (value === undefined || value === "false") return false;
  if (value !== "true" || env.DENTAL_LAB_REGISTRATION_ENABLED !== "true")
    throw new Error("INVALID_GENERAL_MESSAGING_CONFIG");
  return true;
}
