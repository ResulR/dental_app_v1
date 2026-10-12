import { createHash, randomBytes } from "node:crypto";
import { emailKey } from "../identity/index.js";
type Actor = {
  accountId: string;
  profile: "owner" | "admin" | "employee" | "clinic";
  clinicId?: string;
};
export type EmailChangeRecord = {
  id: string;
  revision: number;
  decision: "pending" | "approved" | "refused";
  tokenDigest: Buffer | null;
  expiresAt: number | null;
  consumed: boolean;
  revoked: boolean;
};
type Result = {
  kind:
    | "created"
    | "approved"
    | "refused"
    | "activated"
    | "conflict"
    | "denied"
    | "invalid"
    | "limited";
};
type Ports = {
  // Current active clinic/account + ownership must be rechecked inside createAtomic.
  authorizeRequest: (actor: Actor, clinicId: string) => Promise<boolean>;
  admit: (actor: Actor, trustedNetworkKey: string) => boolean;
  createAtomic: (
    actor: Actor,
    input: {
      clinicId: string;
      newEmailOriginal: string;
      newEmailKey: string;
      expectedRevision: number;
    },
  ) => Promise<"created" | "conflict" | "denied">;
  authorizeDecision: (
    actor: Actor,
    requestId: string,
    action: "clinics.manage",
  ) => Promise<boolean>;
  // Same transaction: recheck grant/active account/pending request/CAS; record decision.
  // Approval queues challenge ONLY to the proposed address through a protected,
  // encrypted transactional email outbox. Never store plaintext token or send before commit.
  // Neither path activates the address. Refusal creates no challenge.
  decideAtomic: (
    actor: Actor,
    requestId: string,
    input: {
      expectedRevision: number;
      decision: "approved" | "refused";
      challenge?: { token: string; digest: Buffer; expiresAt: number };
    },
  ) => Promise<"approved" | "refused" | "conflict" | "denied">;
  admitConfirmation: (trustedNetworkKey: string) => boolean;
  findByDigest: (digest: Buffer) => Promise<EmailChangeRecord | null>;
  // Recheck digest/approval/expiry/unconsumed/unrevoked under row locks and now at commit.
  // CAS request/account; ensure old address unchanged and unique new canonical key.
  // Atomically activate + consume + increment auth_epoch/revoke sessions + append audit
  // and queue old-address security notice. Any failure rolls back ALL these effects.
  activateAtomic: (input: {
    requestId: string;
    expectedRevision: number;
    digest: Buffer;
    now: number;
  }) => Promise<"activated" | "conflict" | "denied">;
};
function revision(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}
function digestToken(token: unknown): Buffer | null {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
    return null;
  const bytes = Buffer.from(token, "base64url");
  if (bytes.length !== 32 || bytes.toString("base64url") !== token) return null;
  // Domain separation: email-confirmation tokens cannot be session/reset digests.
  return createHash("sha256")
    .update("dental-lab:email-change:v1:")
    .update(bytes)
    .digest();
}
export function createClinicEmailChangeService(
  ports: Ports,
  policy: { challengeLifetimeMs: number },
  clock: () => number = Date.now,
) {
  const lifetime = policy.challengeLifetimeMs;
  if (!Number.isSafeInteger(lifetime) || lifetime < 1000)
    throw new Error("INVALID_EMAIL_CHANGE_POLICY");
  let lastNow = -Infinity;
  function now() {
    const value = clock();
    if (!Number.isSafeInteger(value) || value < 0 || value < lastNow)
      throw new Error("INVALID_EMAIL_CHANGE_CLOCK");
    lastNow = value;
    return value;
  }
  return {
    async request(
      actor: Actor,
      input: { clinicId: string; newEmail: unknown; expectedRevision: number },
      trustedNetworkKey: string,
    ): Promise<Result> {
      if (actor.profile !== "clinic" || actor.clinicId !== input.clinicId)
        return { kind: "denied" };
      if (!trustedNetworkKey || trustedNetworkKey.length > 256)
        throw new Error("INVALID_EMAIL_CHANGE_CONTEXT");
      if (!ports.admit(actor, trustedNetworkKey)) return { kind: "limited" };
      const key = emailKey(input.newEmail);
      if (!input.clinicId || !key || !revision(input.expectedRevision))
        return { kind: "invalid" };
      if (!(await ports.authorizeRequest(actor, input.clinicId)))
        return { kind: "denied" };
      return {
        kind: await ports.createAtomic(actor, {
          clinicId: input.clinicId,
          newEmailOriginal: (input.newEmail as string).trim(),
          newEmailKey: key,
          expectedRevision: input.expectedRevision,
        }),
      };
    },
    async decide(
      actor: Actor,
      requestId: string,
      expectedRevision: number,
      decision: "approved" | "refused",
    ): Promise<Result> {
      if (actor.profile !== "owner" && actor.profile !== "admin")
        return { kind: "denied" };
      if (
        !requestId ||
        !revision(expectedRevision) ||
        !["approved", "refused"].includes(decision)
      )
        return { kind: "invalid" };
      if (!(await ports.authorizeDecision(actor, requestId, "clinics.manage")))
        return { kind: "denied" };
      let challenge;
      if (decision === "approved") {
        const expiresAt = now() + lifetime;
        if (
          !Number.isSafeInteger(expiresAt) ||
          !Number.isFinite(new Date(expiresAt).getTime())
        )
          throw new Error("INVALID_EMAIL_CHANGE_POLICY");
        const token = randomBytes(32).toString("base64url");
        challenge = { token, digest: digestToken(token) as Buffer, expiresAt };
      }
      return {
        kind: await ports.decideAtomic(actor, requestId, {
          expectedRevision,
          decision,
          ...(challenge ? { challenge } : {}),
        }),
      };
    },
    async confirm(token: unknown, trustedNetworkKey: string): Promise<Result> {
      if (!trustedNetworkKey || trustedNetworkKey.length > 256)
        throw new Error("INVALID_EMAIL_CHANGE_CONTEXT");
      if (!ports.admitConfirmation(trustedNetworkKey))
        return { kind: "limited" };
      const digest = digestToken(token);
      if (!digest) return { kind: "denied" };
      const record = await ports.findByDigest(digest);
      const timestamp = now();
      if (
        !record ||
        record.decision !== "approved" ||
        record.consumed ||
        record.revoked ||
        record.expiresAt === null ||
        !Number.isSafeInteger(record.expiresAt) ||
        timestamp >= record.expiresAt ||
        !revision(record.revision) ||
        !record.tokenDigest ||
        !record.tokenDigest.equals(digest)
      )
        return { kind: "denied" };
      return {
        kind: await ports.activateAtomic({
          requestId: record.id,
          expectedRevision: record.revision,
          digest,
          now: timestamp,
        }),
      };
    },
  };
}
