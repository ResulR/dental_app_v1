export function retouchEnabled(env: NodeJS.ProcessEnv) {
  const value = env.DENTAL_LAB_RETOUCH_ENABLED;
  if (value === undefined || value === "false") return false;
  if (
    value !== "true" ||
    env.DENTAL_LAB_ORDER_EDIT_ENABLED !== "true" ||
    env.DENTAL_LAB_ORDER_SUBMISSION_ENABLED !== "true"
  )
    throw new Error("INVALID_RETOUCH_CONFIG");
  return true;
}
