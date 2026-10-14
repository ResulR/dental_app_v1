export function registrationEnabled(env: NodeJS.ProcessEnv): boolean {
  const flag = env.DENTAL_LAB_REGISTRATION_ENABLED;
  if (flag === undefined || flag === "false") return false;
  if (flag !== "true" || env.DENTAL_LAB_AUTH_ENABLED !== "true")
    throw new Error("INVALID_REGISTRATION_CONFIG");
  return true;
}
