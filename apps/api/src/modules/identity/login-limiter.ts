import { createHash } from "node:crypto";

export type LoginLimitPolicy = {
  windowMs: number;
  accountAttempts: number;
  networkAttempts: number;
  maxKeys: number;
};
export type LoginAdmission =
  { allowed: true } | { allowed: false; retryAfterSeconds: number };

// One-process adapter. A replicated runtime requires a shared durable adapter.
// Admission consumes an attempt synchronously before any lookup/hash; no email
// or network address appears in stored keys, errors or logs.
export function createLoginLimiter(
  policy: LoginLimitPolicy,
  now: () => number = () => performance.now(),
) {
  const settings = Object.freeze({ ...policy });
  for (const value of [
    settings.windowMs,
    settings.accountAttempts,
    settings.networkAttempts,
    settings.maxKeys,
  ]) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new Error("INVALID_LOGIN_LIMIT_POLICY");
  }
  const entries = new Map<string, { count: number; expires: number }>();
  let lastTime = -Infinity;
  return {
    consume(emailKey: string, networkKey: string): LoginAdmission {
      const at = now();
      if (!Number.isFinite(at) || at < lastTime)
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil(settings.windowMs / 1000),
        };
      lastTime = at;
      for (const [key, value] of entries)
        if (value.expires <= at) entries.delete(key);
      const digest = (kind: string, value: string) =>
        createHash("sha256")
          .update(kind)
          .update("\0")
          .update(value)
          .digest("hex");
      const keys = [digest("account", emailKey), digest("network", networkKey)];
      const limits = [settings.accountAttempts, settings.networkAttempts];
      let retryAfterSeconds = 0;
      for (let i = 0; i < keys.length; i++) {
        const entry = entries.get(keys[i] as string);
        if (entry && entry.count >= (limits[i] as number))
          retryAfterSeconds = Math.max(
            retryAfterSeconds,
            Math.ceil((entry.expires - at) / 1000),
          );
      }
      if (retryAfterSeconds) return { allowed: false, retryAfterSeconds };
      const needed = keys.filter((key) => !entries.has(key)).length;
      if (entries.size + needed > settings.maxKeys)
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil(settings.windowMs / 1000),
        };
      for (const key of keys) {
        const entry = entries.get(key) ?? {
          count: 0,
          expires: at + settings.windowMs,
        };
        entry.count++;
        entries.set(key, entry);
      }
      return { allowed: true };
    },
  };
}
