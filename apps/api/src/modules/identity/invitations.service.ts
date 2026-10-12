import { actionTokenDigest, createActionToken } from "./action-tokens.js";
import { emailKey } from "./authentication.service.js";
import { AuthenticationBusy, hashPassword } from "./passwords.js";
type Actor = {
  accountId: string;
  profile: "owner" | "admin" | "employee" | "clinic";
};
export type EmployeeInvitationRecord = {
  id: string;
  accountId: string;
  accountRevision: number;
  purpose: "employee" | "admin";
  profile: Actor["profile"];
  lifecycle: "invited" | "active" | "suspended";
  securityLocked: boolean;
  targetEmail: string;
  currentEmailKey: string;
  tokenDigest: Buffer;
  expiresAt: number;
  consumed: boolean;
  revoked: boolean;
};
type Ports = {
  admit: (purpose: "issue" | "consume", trustedNetworkKey: string) => boolean;
  authorize: (actor: Actor, action: "employees.create") => Promise<boolean>;
  // Recheck active actor/current delegation; force employee/invited account with
  // no grants. Create invitation, digest, audit and protected encrypted email intent
  // in one transaction. Existing active/suspended account is never overwritten.
  issueAtomic: (
    actor: Actor,
    input: {
      emailOriginal: string;
      emailKey: string;
      profile: "employee";
      token: string;
      digest: Buffer;
      expiresAt: number;
    },
  ) => Promise<"invited" | "conflict" | "denied">;
  findByDigest: (digest: Buffer) => Promise<EmployeeInvitationRecord | null>;
  // Lock/recheck employee+invited/account revision/email/digest/expiry at SQL time,
  // consume once, insert hash credential, activate account, increment epoch/revision,
  // append audit atomically; never grant rights/change profile/unlock/issue session.
  activateAtomic: (input: {
    invitationId: string;
    accountId: string;
    expectedRevision: number;
    digest: Buffer;
    passwordHash: string;
    now: number;
  }) => Promise<"activated" | "denied">;
  hash?: typeof hashPassword;
};
type Result = {
  kind: "invited" | "activated" | "conflict" | "denied" | "invalid" | "limited";
};
export function createEmployeeInvitationService(
  ports: Ports,
  policy: { invitationLifetimeMs: number },
  clock: () => number = Date.now,
) {
  const lifetime = policy.invitationLifetimeMs;
  if (!Number.isSafeInteger(lifetime) || lifetime < 1000)
    throw new Error("INVALID_INVITATION_POLICY");
  const hash = ports.hash ?? hashPassword;
  let lastNow = -Infinity;
  function now() {
    const value = clock();
    if (!Number.isSafeInteger(value) || value < 0 || value < lastNow)
      throw new Error("INVALID_INVITATION_CLOCK");
    lastNow = value;
    return value;
  }
  function network(value: string) {
    if (!value || value.length > 256)
      throw new Error("INVALID_INVITATION_CONTEXT");
  }
  function usable(
    record: EmployeeInvitationRecord | null,
    digest: Buffer,
    timestamp: number,
  ): record is EmployeeInvitationRecord {
    return (
      !!record &&
      record.purpose === "employee" &&
      record.profile === "employee" &&
      record.lifecycle === "invited" &&
      !record.securityLocked &&
      !record.consumed &&
      !record.revoked &&
      record.tokenDigest.length === 32 &&
      record.tokenDigest.equals(digest) &&
      Number.isSafeInteger(record.accountRevision) &&
      record.accountRevision > 0 &&
      emailKey(record.targetEmail) === record.currentEmailKey &&
      Number.isSafeInteger(record.expiresAt) &&
      timestamp < record.expiresAt
    );
  }
  return {
    async invite(
      actor: Actor,
      email: unknown,
      trustedNetworkKey: string,
    ): Promise<Result> {
      if (actor.profile !== "owner" && actor.profile !== "admin")
        return { kind: "denied" };
      network(trustedNetworkKey);
      if (!ports.admit("issue", trustedNetworkKey)) return { kind: "limited" };
      const key = emailKey(email);
      if (!key) return { kind: "invalid" };
      if (!(await ports.authorize(actor, "employees.create")))
        return { kind: "denied" };
      const expiresAt = now() + lifetime;
      if (
        !Number.isSafeInteger(expiresAt) ||
        !Number.isFinite(new Date(expiresAt).getTime())
      )
        throw new Error("INVALID_INVITATION_POLICY");
      return {
        kind: await ports.issueAtomic(actor, {
          emailOriginal: (email as string).trim(),
          emailKey: key,
          profile: "employee",
          ...createActionToken("employee-invitation"),
          expiresAt,
        }),
      };
    },
    async accept(
      token: unknown,
      password: unknown,
      trustedNetworkKey: string,
    ): Promise<Result> {
      network(trustedNetworkKey);
      if (!ports.admit("consume", trustedNetworkKey))
        return { kind: "limited" };
      const digest = actionTokenDigest("employee-invitation", token);
      if (!digest) return { kind: "denied" };
      const record = await ports.findByDigest(digest);
      if (!usable(record, digest, now())) return { kind: "denied" };
      if (typeof password !== "string") return { kind: "invalid" };
      let passwordHash;
      try {
        passwordHash = await hash(password);
      } catch (error) {
        if (error instanceof AuthenticationBusy) return { kind: "limited" };
        if (error instanceof Error && error.message === "INVALID_NEW_PASSWORD")
          return { kind: "invalid" };
        throw error;
      }
      const timestamp = now();
      if (!usable(record, digest, timestamp)) return { kind: "denied" };
      return {
        kind: await ports.activateAtomic({
          invitationId: record.id,
          accountId: record.accountId,
          expectedRevision: record.accountRevision,
          digest,
          passwordHash,
          now: timestamp,
        }),
      };
    },
  };
}
