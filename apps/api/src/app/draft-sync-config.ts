export function draftSyncEnabled(env: NodeJS.ProcessEnv) {
  const value = env.DENTAL_LAB_DRAFT_SYNC_ENABLED;
  if (value === undefined || value === "false") return false;
  if (value !== "true" || env.DENTAL_LAB_AUTH_ENABLED !== "true")
    throw new Error("INVALID_DRAFT_SYNC_CONFIG");
  return true;
}
