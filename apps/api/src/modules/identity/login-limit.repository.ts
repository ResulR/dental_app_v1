import { createHash, timingSafeEqual } from "node:crypto";
import type { createApplicationDatabase } from "../../shared/database.js";
import type { LoginAdmission, LoginLimitPolicy } from "./login-limiter.js";

type Database = Pick<
  ReturnType<typeof createApplicationDatabase>,
  "transaction"
>;
export function createPersistentLoginLimiter(
  database: Database,
  policy: LoginLimitPolicy,
) {
  const settings = Object.freeze({ ...policy });
  if (
    !Number.isSafeInteger(settings.windowMs) ||
    settings.windowMs < 1000 ||
    settings.windowMs > 86400000 ||
    !Number.isSafeInteger(settings.accountAttempts) ||
    settings.accountAttempts < 1 ||
    settings.accountAttempts > 1000000 ||
    !Number.isSafeInteger(settings.networkAttempts) ||
    settings.networkAttempts < 1 ||
    settings.networkAttempts > 1000000 ||
    !Number.isSafeInteger(settings.maxKeys) ||
    settings.maxKeys < 2 ||
    settings.maxKeys > 100000
  )
    throw new Error("INVALID_LOGIN_LIMIT_POLICY");
  const policyDigest = createHash("sha256")
    .update(
      JSON.stringify([
        settings.windowMs,
        settings.accountAttempts,
        settings.networkAttempts,
        settings.maxKeys,
      ]),
    )
    .digest();
  return {
    async consume(email: string, network: string): Promise<LoginAdmission> {
      const keys = [
        createHash("sha256").update("account\0").update(email).digest(),
        createHash("sha256").update("network\0").update(network).digest(),
      ];
      return database.transaction(async (tx) => {
        const guard = await tx.query<{ policy_digest: Buffer | null }>(
          "SELECT policy_digest FROM public.login_limit_guard WHERE singleton=1 FOR UPDATE",
        );
        const stored = guard.rows[0];
        if (
          !stored ||
          (stored.policy_digest !== null &&
            (stored.policy_digest.length !== 32 ||
              !timingSafeEqual(stored.policy_digest, policyDigest)))
        )
          throw new Error("LOGIN_LIMIT_POLICY_MISMATCH");
        if (stored.policy_digest === null)
          await tx.query(
            "UPDATE public.login_limit_guard SET policy_digest=$1 WHERE singleton=1",
            [policyDigest],
          );
        const clock = await tx.query<{ at: string }>(
          "SELECT (extract(epoch FROM clock_timestamp())*1000)::bigint::text AS at",
        );
        const at = Number(clock.rows[0]?.at);
        if (!Number.isSafeInteger(at) || at < 0)
          throw new Error("INVALID_DATABASE_CLOCK");
        await tx.query(
          "DELETE FROM public.login_attempt_limits WHERE expires_at <= $1",
          [new Date(at)],
        );
        const entries = await tx.query<{
          key_digest: Buffer;
          attempts: number;
          expires: string;
        }>(
          `SELECT key_digest,attempts,
          (extract(epoch FROM expires_at)*1000)::bigint::text AS expires
          FROM public.login_attempt_limits WHERE key_digest=ANY($1::bytea[])`,
          [keys],
        );
        let retry = 0;
        for (let i = 0; i < keys.length; i++) {
          const entry = entries.rows.find((row) =>
            row.key_digest.equals(keys[i] as Buffer),
          );
          const limit =
            i === 0 ? settings.accountAttempts : settings.networkAttempts;
          if (entry && entry.attempts >= limit)
            retry = Math.max(
              retry,
              Math.ceil((Number(entry.expires) - at) / 1000),
            );
        }
        if (retry > 0) return { allowed: false, retryAfterSeconds: retry };
        const count = await tx.query<{ count: number }>(
          "SELECT count(*)::integer AS count FROM public.login_attempt_limits",
        );
        if (
          (count.rows[0]?.count ?? settings.maxKeys) +
            keys.length -
            entries.rows.length >
          settings.maxKeys
        )
          return {
            allowed: false,
            retryAfterSeconds: Math.ceil(settings.windowMs / 1000),
          };
        for (const key of keys)
          await tx.query(
            `INSERT INTO public.login_attempt_limits(key_digest,attempts,expires_at) VALUES ($1,1,$2)
            ON CONFLICT (key_digest) DO UPDATE SET attempts=public.login_attempt_limits.attempts+1`,
            [key, new Date(at + settings.windowMs)],
          );
        return { allowed: true };
      });
    },
  };
}
