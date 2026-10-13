import { mutationOriginAllowed } from "../modules/identity/index.js";
export function readAuthConfig(
  env: Readonly<Record<string, string | undefined>>,
) {
  const enabled = env.DENTAL_LAB_AUTH_ENABLED;
  if (enabled === undefined || enabled === "false") return null;
  if (enabled !== "true") throw new Error("INVALID_AUTH_ENABLED");
  const origin = env.DENTAL_LAB_ORIGIN;
  if (!origin || !mutationOriginAllowed(origin, origin))
    throw new Error("INVALID_AUTH_ORIGIN");
  function integer(name: string, min: number, max: number): number {
    const value = env[name];
    if (value === undefined || !/^[1-9][0-9]*$/.test(value))
      throw new Error("INVALID_AUTH_POLICY");
    const result = Number(value);
    if (!Number.isSafeInteger(result) || result < min || result > max)
      throw new Error("INVALID_AUTH_POLICY");
    return result;
  }
  const lifetimeMs = integer(
    "DENTAL_LAB_SESSION_LIFETIME_MS",
    1000,
    2592000000,
  );
  const absoluteLifetimeMs = integer(
    "DENTAL_LAB_SESSION_ABSOLUTE_MS",
    lifetimeMs,
    2592000000,
  );
  return {
    origin,
    session: { lifetimeMs, absoluteLifetimeMs },
    loginLimit: {
      windowMs: integer("DENTAL_LAB_LOGIN_WINDOW_MS", 1000, 86400000),
      accountAttempts: integer("DENTAL_LAB_LOGIN_ACCOUNT_ATTEMPTS", 1, 1000000),
      networkAttempts: integer("DENTAL_LAB_LOGIN_NETWORK_ATTEMPTS", 1, 1000000),
      maxKeys: integer("DENTAL_LAB_LOGIN_MAX_KEYS", 2, 100000),
    },
  };
}
