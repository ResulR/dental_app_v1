import { domainToASCII } from "node:url";
import { AuthenticationBusy, verifyPassword } from "./passwords.js";
import type { LoginAdmission } from "./login-limiter.js";

export type CredentialAccount = {
  id: string;
  profile: "owner" | "admin" | "employee" | "clinic";
  lifecycle: string;
  security_locked: boolean;
  credential_reset_required: boolean;
  clinic_suspended: boolean;
  auth_epoch: string;
  password_hash: string;
};
type Ports = {
  findCredential: (emailKey: string) => Promise<CredentialAccount | undefined>;
  admit: (
    emailKey: string,
    trustedNetworkKey: string,
  ) => LoginAdmission | Promise<LoginAdmission>;
  verify?: (password: unknown, hash: unknown) => Promise<boolean>;
};
export type AuthenticationResult =
  | {
      kind: "authenticated";
      accountId: string;
      profile: CredentialAccount["profile"];
      authEpoch: string;
    }
  | { kind: "denied" }
  | { kind: "limited"; retryAfterSeconds: number };

// Preserve local-part spelling/case and provider aliases; IDNA/lowercase domain
// only. Same function must be used by registration and email changes.
export function emailKey(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 320) return null;
  const parts = value.trim().split("@");
  if (parts.length !== 2) return null;
  const local = parts[0] as string;
  const host = domainToASCII(parts[1] as string).toLowerCase();
  if (
    !local ||
    Buffer.byteLength(local, "utf8") > 64 ||
    /\s/u.test(local) ||
    Array.from(local).some(
      (character) =>
        (character.codePointAt(0) as number) < 32 ||
        character.codePointAt(0) === 127,
    ) ||
    !host ||
    host.length > 255 ||
    !host
      .split(".")
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label))
  )
    return null;
  return local + "@" + host;
}
export function createAuthenticationService(ports: Ports) {
  const verify = ports.verify ?? verifyPassword;
  return {
    async authenticate(
      email: unknown,
      password: unknown,
      trustedNetworkKey: string,
    ): Promise<AuthenticationResult> {
      if (!trustedNetworkKey || trustedNetworkKey.length > 256)
        throw new Error("INVALID_LOGIN_CONTEXT");
      const key = emailKey(email);
      const admitted = await ports.admit(
        key ?? "<invalid-email>",
        trustedNetworkKey,
      );
      if (!admitted.allowed)
        return {
          kind: "limited",
          retryAfterSeconds: admitted.retryAfterSeconds,
        };
      if (!key || typeof password !== "string") return { kind: "denied" };
      const account = await ports.findCredential(key);
      let correct: boolean;
      try {
        correct = await verify(password, account?.password_hash);
      } catch (error) {
        if (error instanceof AuthenticationBusy)
          return { kind: "limited", retryAfterSeconds: 1 };
        throw error;
      }
      if (
        !correct ||
        !account ||
        account.lifecycle !== "active" ||
        account.security_locked ||
        account.credential_reset_required ||
        account.clinic_suspended ||
        !/^(0|[1-9][0-9]*)$/u.test(account.auth_epoch)
      )
        return { kind: "denied" };
      // This is a credential fact, not a session or grant. Session issuance must
      // recheck lifecycle/epoch atomically after potentially expensive hashing.
      return {
        kind: "authenticated",
        accountId: account.id,
        profile: account.profile,
        authEpoch: account.auth_epoch,
      };
    },
  };
}
