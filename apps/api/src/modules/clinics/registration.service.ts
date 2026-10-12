import {
  AuthenticationBusy,
  emailKey,
  hashPassword,
} from "../identity/index.js";
import type { LoginAdmission } from "../identity/index.js";

export type ClinicRegistration = {
  name: string;
  dentist_first_name: string;
  dentist_last_name: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  accepted_terms: true;
  terms_version_id: string;
};
type StoredRegistration = Omit<
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
  admit: (emailKey: string, trustedNetworkKey: string) => LoginAdmission;
  hash?: (password: string) => Promise<string>;
  // Account, credential, pending clinic, legal acceptance, conversation and
  // audit/outbox must be committed together; recheck current approved terms
  // inside that transaction. No raw password reaches storage.
  registerAtomic: (
    data: StoredRegistration,
  ) => Promise<"created" | "duplicate" | "terms_changed">;
};
export type RegistrationResult =
  | { kind: "pending" }
  | { kind: "invalid"; fields: string[] }
  | { kind: "unavailable" }
  | { kind: "conflict" }
  | { kind: "limited"; retryAfterSeconds: number };

const textFields = [
  "name",
  "dentist_first_name",
  "dentist_last_name",
  "email",
  "phone",
  "address",
] as const;
const allowed = new Set([
  ...textFields,
  "password",
  "accepted_terms",
  "terms_version_id",
]);
function parse(input: unknown): ClinicRegistration | string[] {
  if (!input || typeof input !== "object" || Array.isArray(input)) return ["/"];
  const body = input as Record<string, unknown>;
  const fields = Object.keys(body)
    .filter((key) => !allowed.has(key))
    .map(() => "/");
  for (const key of textFields)
    if (
      typeof body[key] !== "string" ||
      (body[key] as string).trim().length === 0
    )
      fields.push("/" + key);
  if (!emailKey(body.email)) fields.push("/email");
  if (
    typeof body.password !== "string" ||
    Array.from(body.password).length < 15 ||
    Buffer.byteLength(body.password) > 1024
  )
    fields.push("/password");
  if (body.accepted_terms !== true) fields.push("/accepted_terms");
  if (
    typeof body.terms_version_id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
      body.terms_version_id,
    )
  )
    fields.push("/terms_version_id");
  if (fields.length) return [...new Set(fields)];
  return body as ClinicRegistration;
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
      const admitted = ports.admit(key, trustedNetworkKey);
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
