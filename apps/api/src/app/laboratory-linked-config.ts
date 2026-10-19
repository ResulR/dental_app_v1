export function laboratoryLinkedEnabled(env: NodeJS.ProcessEnv) {
  const value = env.DENTAL_LAB_LABORATORY_LINKED_ENABLED;
  if (value === undefined || value === "false") return false;
  if (
    value !== "true" ||
    env.DENTAL_LAB_ORDER_SUBMISSION_ENABLED !== "true" ||
    env.DENTAL_LAB_ORDER_REQUEST_ENABLED !== "true"
  )
    throw new Error("INVALID_LABORATORY_LINKED_CONFIG");
  return true;
}
