export function internalNoticesEnabled(env: NodeJS.ProcessEnv) {
  const value = env.DENTAL_LAB_INTERNAL_NOTICES_ENABLED;
  if (value === undefined || value === "false") return false;
  if (value !== "true" || env.DENTAL_LAB_REGISTRATION_ENABLED !== "true")
    throw new Error("INVALID_INTERNAL_NOTICES_CONFIG");
  return true;
}
