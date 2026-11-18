export function emailQueueReadEnabled(env: NodeJS.ProcessEnv) {
  const flag = env.DENTAL_LAB_EMAIL_QUEUE_READ_ENABLED;
  if (flag === undefined || flag === "false") return false;
  if (flag !== "true") throw new Error("INVALID_EMAIL_QUEUE_READ_CONFIG");
  return true;
}
