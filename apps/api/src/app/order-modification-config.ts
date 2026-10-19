export function orderModificationEnabled(env: NodeJS.ProcessEnv) {
  const value = env.DENTAL_LAB_ORDER_MODIFICATION_ENABLED;
  if (value === undefined || value === "false") return false;
  if (
    value !== "true" ||
    env.DENTAL_LAB_ORDER_EDIT_ENABLED !== "true" ||
    env.DENTAL_LAB_ORDER_REQUEST_ENABLED !== "true"
  )
    throw new Error("INVALID_ORDER_MODIFICATION_CONFIG");
  return true;
}
