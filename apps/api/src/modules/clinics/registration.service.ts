import {
  AuthenticationBusy,
  emailKey,
  hashPassword,
} from "../identity/index.js";
import type { LoginAdmission } from "../identity/index.js";

import { ClinicRegistrationRequestSchema } from "@dental-lab/contracts";
import type { ClinicRegistration } from "@dental-lab/contracts";
export type { ClinicRegistration } from "@dental-lab/contracts";
export type StoredRegistration = Omit<
  ClinicRegistration,
  "password" | "accepted_terms"
> & {
  email_key: string;
  password_hash: string;
  review_state: "pending";
  profile: "clinic";
};
type Ports = {
  currentTermsVersion: () => Promise<string | undefined>;
  ownerInitialized: () => Promise<boolean>;
  admit: (
    emailKey: string,
    trustedNetworkKey: string,
  ) => LoginAdmission | Promise<LoginAdmission>;
  hash?: (password: string) => Promise<string>;
  // Account, credential, pending clinic, legal acceptance, conversation and
  // audit/outbox must be committed together; recheck current approved terms
  // inside that transaction. No raw password reaches storage.
  registerAtomic: (
    data: StoredRegistration,
  ) => Promise<"created" | "duplicate" | "terms_changed" | "unavailable">;
};
export type RegistrationResult =
  | { kind: "pending" }
  | { kind: "invalid"; fields: string[] }
  | { kind: "unavailable" }
  | { kind: "conflict" }
  | { kind: "limited"; retryAfterSeconds: number };

function parse(input: unknown): ClinicRegistration | string[] {
  const parsed = ClinicRegistrationRequestSchema.safeParse(input);
  if (!parsed.success)
    return [
      ...new Set(
        parsed.error.issues.map((issue) =>
          issue.path.length === 1 ? "/" + String(issue.path[0]) : "/",
        ),
      ),
    ];
  const fields: string[] = [];
  if (!emailKey(parsed.data.email)) fields.push("/email");
  if (
    Array.from(parsed.data.password).length < 15 ||
    Buffer.byteLength(parsed.data.password) > 1024
  )
    fields.push("/password");
  return fields.length ? fields : parsed.data;
}
export function createClinicRegistrationService(ports: Ports) {
  const hash = ports.hash ?? hashPassword;
  return {
    async register(
      input: unknown,
      trustedNetworkKey: string,
    ): Promise<RegistrationResult> {
      if (!trustedNetworkKey || trustedNetworkKey.length > 256)
        throw new Error("INVALID_REGISTRATION_CONTEXT");
      const parsed = parse(input);
      const key = !Array.isArray(parsed)
        ? (emailKey(parsed.email) as string)
        : "<invalid-registration>";
      const admitted = await ports.admit(key, trustedNetworkKey);
      if (!admitted.allowed)
        return {
          kind: "limited",
          retryAfterSeconds: admitted.retryAfterSeconds,
        };
      if (Array.isArray(parsed)) return { kind: "invalid", fields: parsed };
      const currentTerms = await ports.currentTermsVersion();
      if (!currentTerms || !(await ports.ownerInitialized()))
        return { kind: "unavailable" };
      if (parsed.terms_version_id.toLowerCase() !== currentTerms.toLowerCase())
        return { kind: "invalid", fields: ["/terms_version_id"] };
      let passwordHash: string;
      try {
        passwordHash = await hash(parsed.password);
      } catch (error) {
        if (error instanceof AuthenticationBusy)
          return { kind: "limited", retryAfterSeconds: 1 };
        if (error instanceof Error && error.message === "INVALID_NEW_PASSWORD")
          return { kind: "invalid", fields: ["/password"] };
        throw error;
      }
      const result = await ports.registerAtomic({
        name: parsed.name.trim(),
        dentist_first_name: parsed.dentist_first_name.trim(),
        dentist_last_name: parsed.dentist_last_name.trim(),
        email: parsed.email.trim(),
        email_key: key,
        phone: parsed.phone.trim(),
        address: parsed.address.trim(),
        terms_version_id: currentTerms,
        password_hash: passwordHash,
        profile: "clinic",
        review_state: "pending",
      });
      if (result === "unavailable") return { kind: "unavailable" };
      if (result === "terms_changed")
        return { kind: "invalid", fields: ["/terms_version_id"] };
      return { kind: result === "created" ? "pending" : "conflict" };
    },
  };
}
export function clinicCanSubmit(current: {
  profile: string;
  lifecycle: string;
  reviewState: string;
  suspended: boolean;
  securityLocked: boolean;
  credentialResetRequired: boolean;
}): boolean {
  return (
    current.profile === "clinic" &&
    current.lifecycle === "active" &&
    current.reviewState === "approved" &&
    !current.suspended &&
    !current.securityLocked &&
    !current.credentialResetRequired
  );
}
