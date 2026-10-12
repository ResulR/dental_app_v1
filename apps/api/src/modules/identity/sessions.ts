import { createHash, randomBytes } from "node:crypto";
import type { AuthenticationResult } from "./authentication.service.js";

type Fact = Extract<AuthenticationResult, { kind: "authenticated" }>;
export type SessionRecord = {
  id: string;
  accountId: string;
  profile: Fact["profile"];
  authEpoch: string;
  currentAuthEpoch: string;
  accountUsable: boolean;
  createdAt: number;
  expiresAt: number;
  absoluteExpiresAt: number;
  revokedAt: number | null;
};
export type SessionWrite = {
  fact: Fact;
  digest: Buffer;
  createdAt: number;
  expiresAt: number;
  absoluteExpiresAt: number;
};
export type SessionStore = {
  find: (digest: Buffer) => Promise<SessionRecord | undefined>;
  // Implementations must recheck account state/epoch and persist the session,
  // limit and required audit within the same transaction before returning true.
  issue: (input: SessionWrite) => Promise<boolean>;
  rotate: (old: SessionRecord, next: SessionWrite) => Promise<boolean>;
  revokeOne: (accountId: string, sessionId: string) => Promise<void>;
  revokeAll: (accountId: string) => Promise<void>;
};
export const sessionCookieName = "__Host-dental_session";
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
function digest(token: string): Buffer | null {
  if (!tokenPattern.test(token)) return null;
  const bytes = Buffer.from(token, "base64url");
  if (bytes.length !== 32 || bytes.toString("base64url") !== token) return null;
  try {
    return createHash("sha256").update(bytes).digest();
  } finally {
    bytes.fill(0);
  }
}
export function readSessionCookie(header: unknown): string | null {
  if (typeof header !== "string" || header.length > 8192) return null;
  const matches = header
    .split(";")
    .map((value) => value.trim())
    .filter((value) => value.startsWith(sessionCookieName + "="));
  if (matches.length !== 1) return null;
  const token = (matches[0] as string).slice(sessionCookieName.length + 1);
  return digest(token) ? token : null;
}
function cookie(token: string, maxAgeSeconds: number): string {
  return (
    sessionCookieName +
    "=" +
    token +
    "; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=" +
    maxAgeSeconds
  );
}
export function clearSessionCookie(): string {
  return cookie("", 0);
}
export function mutationOriginAllowed(
  origin: unknown,
  configuredOrigin: string,
): boolean {
  let expected: URL;
  try {
    expected = new URL(configuredOrigin);
  } catch {
    return false;
  }
  if (
    expected.protocol !== "https:" ||
    expected.origin !== configuredOrigin ||
    expected.username ||
    expected.password
  )
    return false;
  return typeof origin === "string" && origin === configuredOrigin;
}
export function createSessionService(
  store: SessionStore,
  policy: { lifetimeMs: number; absoluteLifetimeMs: number },
  now: () => number = Date.now,
) {
  const settings = Object.freeze({ ...policy });
  if (
    !Number.isSafeInteger(settings.lifetimeMs) ||
    settings.lifetimeMs < 1000 ||
    !Number.isSafeInteger(settings.absoluteLifetimeMs) ||
    settings.absoluteLifetimeMs < settings.lifetimeMs ||
    settings.absoluteLifetimeMs > 30 * 24 * 60 * 60 * 1000
  )
    throw new Error("INVALID_SESSION_POLICY");
  let previousTime = -Infinity;
  function clock(): number {
    const value = now();
    if (!Number.isSafeInteger(value) || value < previousTime)
      throw new Error("INVALID_SESSION_CLOCK");
    previousTime = value;
    return value;
  }
  function usable(record: SessionRecord, at: number): boolean {
    return (
      record.accountUsable &&
      record.revokedAt === null &&
      record.authEpoch === record.currentAuthEpoch &&
      [record.createdAt, record.expiresAt, record.absoluteExpiresAt].every(
        Number.isSafeInteger,
      ) &&
      record.createdAt <= at &&
      at < record.expiresAt &&
      record.expiresAt <= record.absoluteExpiresAt &&
      at < record.absoluteExpiresAt
    );
  }
  async function load(token: string): Promise<SessionRecord | undefined> {
    const hash = digest(token);
    if (!hash) return undefined;
    const record = await store.find(hash);
    return record && usable(record, clock()) ? record : undefined;
  }
  function next(fact: Fact, at: number, absoluteExpiresAt: number) {
    const bytes = randomBytes(32);
    try {
      const token = bytes.toString("base64url");
      const write: SessionWrite = {
        fact,
        digest: createHash("sha256").update(bytes).digest(),
        createdAt: at,
        expiresAt: Math.min(at + settings.lifetimeMs, absoluteExpiresAt),
        absoluteExpiresAt,
      };
      return { token, write };
    } finally {
      bytes.fill(0);
    }
  }
  return {
    async issue(fact: Fact): Promise<{ setCookie: string } | null> {
      const at = clock();
      const created = next(fact, at, at + settings.absoluteLifetimeMs);
      if (!(await store.issue(created.write))) return null;
      return {
        setCookie: cookie(
          created.token,
          Math.floor((created.write.expiresAt - at) / 1000),
        ),
      };
    },
    async authenticate(token: string): Promise<{
      accountId: string;
      profile: Fact["profile"];
      sessionId: string;
    } | null> {
      const record = await load(token);
      return record
        ? {
            accountId: record.accountId,
            profile: record.profile,
            sessionId: record.id,
          }
        : null;
    },
    async renew(
      token: string,
    ): Promise<
      { kind: "renewed"; setCookie: string } | { kind: "not_due" } | null
    > {
      const old = await load(token);
      if (!old) return null;
      const at = clock();
      if (old.expiresAt - at > settings.lifetimeMs / 2)
        return { kind: "not_due" };
      if (old.absoluteExpiresAt - at < 1000) return null;
      const created = next(
        {
          kind: "authenticated",
          accountId: old.accountId,
          profile: old.profile,
          authEpoch: old.authEpoch,
        },
        at,
        old.absoluteExpiresAt,
      );
      if (!(await store.rotate(old, created.write))) return null;
      return {
        kind: "renewed",
        setCookie: cookie(
          created.token,
          Math.floor((created.write.expiresAt - at) / 1000),
        ),
      };
    },
    async logout(token: string): Promise<string> {
      const record = await load(token);
      if (record) await store.revokeOne(record.accountId, record.id);
      return clearSessionCookie();
    },
    // Trusted server caller after current identity/authorization, never body ID.
    async revokeAllForAccount(accountId: string): Promise<void> {
      await store.revokeAll(accountId);
    },
  };
}
