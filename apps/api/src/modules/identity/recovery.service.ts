import { actionTokenDigest, createActionToken } from "./action-tokens.js";
import { emailKey } from "./authentication.service.js";
import { AuthenticationBusy, hashPassword } from "./passwords.js";
export type RecoveryRecord = {
  id: string;
  accountId: string;
  tokenDigest: Buffer;
  authEpoch: string;
  currentAuthEpoch: string;
  expiresAt: number;
  consumed: boolean;
  revoked: boolean;
  lifecycle: "active" | "invited" | "suspended";
  securityLocked: boolean;
};
type Ports = {
  admit: (
    purpose: "request" | "consume",
    key: string,
    trustedNetworkKey: string,
  ) => boolean | Promise<boolean>;
  // Atomically condition on current eligible account/address; enqueue private encrypted
  // email challenge + store digest/epoch/expiry, or no-op. No account existence result.
  // Do NOT send before commit or persist plaintext token. Do NOT clear security flags.
  enqueueAtomic: (input: {
    emailKey: string;
    token: string;
    digest: Buffer;
    expiresAt: number;
  }) => Promise<void>;
  findByDigest: (digest: Buffer) => Promise<RecoveryRecord | null>;
  // Same transaction rechecks expiry at SQL consumption time, digest/epoch/account state,
  // consumes one token, replaces credential, clears reset-required only, increments epoch,
  // revokes all sessions/other recovery tokens, appends audit + private security notice.
  // No login/session issuance, no suspension/security-lock/clinic-approval changes.
  resetAtomic: (input: {
    requestId: string;
    accountId: string;
    expectedAuthEpoch: string;
    digest: Buffer;
    passwordHash: string;
    now: number;
  }) => Promise<"reset" | "denied">;
  hash?: typeof hashPassword;
};
type Result = { kind: "accepted" | "reset" | "denied" | "invalid" | "limited" };
export function createPasswordRecoveryService(
  ports: Ports,
  policy: { tokenLifetimeMs: number },
  clock: () => number = Date.now,
) {
  const lifetime = policy.tokenLifetimeMs;
  if (!Number.isSafeInteger(lifetime) || lifetime < 1000)
    throw new Error("INVALID_RECOVERY_POLICY");
  const hash = ports.hash ?? hashPassword;
  let lastNow = -Infinity;
  function now() {
    const value = clock();
    if (!Number.isSafeInteger(value) || value < 0 || value < lastNow)
      throw new Error("INVALID_RECOVERY_CLOCK");
    lastNow = value;
    return value;
  }
  function network(value: string) {
    if (!value || value.length > 256)
      throw new Error("INVALID_RECOVERY_CONTEXT");
  }
  function usable(
    record: RecoveryRecord | null,
    digest: Buffer,
    timestamp: number,
  ): record is RecoveryRecord {
    return (
      !!record &&
      record.tokenDigest.length === 32 &&
      record.tokenDigest.equals(digest) &&
      !record.consumed &&
      !record.revoked &&
      record.lifecycle === "active" &&
      !record.securityLocked &&
      /^[0-9]+$/.test(record.authEpoch) &&
      record.authEpoch === record.currentAuthEpoch &&
      Number.isSafeInteger(record.expiresAt) &&
      timestamp < record.expiresAt
    );
  }
  return {
    async request(email: unknown, trustedNetworkKey: string): Promise<Result> {
      network(trustedNetworkKey);
      const key = emailKey(email);
      if (
        !(await ports.admit(
          "request",
          key ?? "<invalid-email>",
          trustedNetworkKey,
        ))
      )
        return { kind: "limited" };
      if (!key) return { kind: "accepted" };
      const expiresAt = now() + lifetime;
      if (
        !Number.isSafeInteger(expiresAt) ||
        !Number.isFinite(new Date(expiresAt).getTime())
      )
        throw new Error("INVALID_RECOVERY_POLICY");
      const challenge = createActionToken("password-recovery");
      await ports.enqueueAtomic({
        emailKey: key,
        ...challenge,
        expiresAt,
      });
      return { kind: "accepted" };
    },
    async reset(
      token: unknown,
      newPassword: unknown,
      trustedNetworkKey: string,
    ): Promise<Result> {
      network(trustedNetworkKey);
      const digest = actionTokenDigest("password-recovery", token);
      if (
        !(await ports.admit(
          "consume",
          digest?.toString("hex") ?? "<invalid-token>",
          trustedNetworkKey,
        ))
      )
        return { kind: "limited" };
      if (!digest) return { kind: "denied" };
      const record = await ports.findByDigest(digest);
      if (!usable(record, digest, now())) return { kind: "denied" };
      if (typeof newPassword !== "string") return { kind: "invalid" };
      let passwordHash;
      try {
        passwordHash = await hash(newPassword);
      } catch (error) {
        if (error instanceof AuthenticationBusy) return { kind: "limited" };
        if (error instanceof Error && error.message === "INVALID_NEW_PASSWORD")
          return { kind: "invalid" };
        throw error;
      }
      const timestamp = now();
      if (!usable(record, digest, timestamp)) return { kind: "denied" };
      return {
        kind: await ports.resetAtomic({
          requestId: record.id,
          accountId: record.accountId,
          expectedAuthEpoch: record.authEpoch,
          digest,
          passwordHash,
          now: timestamp,
        }),
      };
    },
  };
}
