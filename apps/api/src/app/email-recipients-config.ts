export function emailRecipientsEnabled(env: NodeJS.ProcessEnv) {
  const flag = env.DENTAL_LAB_EMAIL_RECIPIENTS_ENABLED;
  if (flag === undefined || flag === "false") return false;
  if (flag !== "true") throw new Error("INVALID_EMAIL_RECIPIENTS_CONFIG");
  return true;
}
