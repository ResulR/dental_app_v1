import { createHash, randomBytes } from "node:crypto";
type Purpose =
  | "email-change"
  | "password-recovery"
  | "employee-invitation"
  | "admin-invitation";
export function actionTokenDigest(
  purpose: Purpose,
  token: unknown,
): Buffer | null {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
    return null;
  const bytes = Buffer.from(token, "base64url");
  if (bytes.length !== 32 || bytes.toString("base64url") !== token) return null;
  return createHash("sha256")
    .update("dental-lab:" + purpose + ":v1:")
    .update(bytes)
    .digest();
}
export function createActionToken(purpose: Purpose) {
  const token = randomBytes(32).toString("base64url");
  return { token, digest: actionTokenDigest(purpose, token) as Buffer };
}
