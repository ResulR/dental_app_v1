export function auditReadEnabled(env: NodeJS.ProcessEnv) {
  const flag = env.DENTAL_LAB_AUDIT_READ_ENABLED;
  if (flag === undefined || flag === "false") return false;
  if (flag !== "true") throw new Error("INVALID_AUDIT_READ_CONFIG");
  return true;
}
