import { actionTokenDigest } from "../identity/index.js";

type Purpose = Parameters<typeof actionTokenDigest>[0];
const copy: Record<Purpose, { subject: string; instruction: string }> = {
  "email-change": {
    subject: "Konfirmoni adresën e re të emailit",
    instruction:
      "Kërkesa për ndryshimin e adresës është miratuar. Konfirmoni adresën e re për ta aktivizuar.",
  },
  "password-recovery": {
    subject: "Rivendosja e fjalëkalimit",
    instruction:
      "Është kërkuar rivendosja e fjalëkalimit. Hapni lidhjen për të zgjedhur një fjalëkalim të ri.",
  },
  "employee-invitation": {
    subject: "Ftesë për llogari punonjësi",
    instruction:
      "Jeni ftuar të krijoni llogarinë tuaj individuale të punonjësit. Zgjidhni vetë fjalëkalimin tuaj.",
  },
  "admin-invitation": {
    subject: "Ftesë për llogari administratori",
    instruction:
      "Jeni ftuar të krijoni llogarinë tuaj të administratorit. Zgjidhni vetë fjalëkalimin tuaj. Lejet caktohen veçmas nga pronari.",
  },
};
function parseUrl(value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error("INVALID_ACCOUNT_EMAIL_URL");
  }
}
function portal(origin: string) {
  const url = parseUrl(origin);
  if (
    url.protocol !== "https:" ||
    url.origin !== origin ||
    url.username ||
    url.password
  )
    throw new Error("INVALID_ACCOUNT_EMAIL_ORIGIN");
  return url;
}
// Private, transient rendering only. Never return this payload to the requester,
// log it, or persist it unencrypted. No provider or delivery side effects.
export function accountChallengeEmail(input: {
  purpose: Purpose;
  token: string;
  origin: string;
  landingUrl: string;
  expiresAt: number;
  now: number;
}): { subject: string; text: string } {
  const base = portal(input.origin);
  if (
    !Object.hasOwn(copy, input.purpose) ||
    !actionTokenDigest(input.purpose, input.token)
  )
    throw new Error("INVALID_ACCOUNT_EMAIL_CHALLENGE");
  if (
    !Number.isSafeInteger(input.now) ||
    input.now < 0 ||
    !Number.isSafeInteger(input.expiresAt) ||
    input.expiresAt <= input.now ||
    !Number.isFinite(new Date(input.expiresAt).getTime())
  )
    throw new Error("INVALID_ACCOUNT_EMAIL_EXPIRY");
  const link = parseUrl(input.landingUrl);
  if (
    link.origin !== base.origin ||
    link.href !== input.landingUrl ||
    link.username ||
    link.password ||
    link.search ||
    link.hash ||
    decodeURIComponent(link.pathname).includes(input.token) ||
    /[?#]/.test(input.landingUrl) ||
    input.landingUrl.length > 2048
  )
    throw new Error("INVALID_ACCOUNT_EMAIL_LANDING");
  // The caller must configure a real receiving page before delivery is enabled.
  // Fragments are not sent in the HTTP request; browser consumption still needs
  // URL removal, no telemetry, no caching and explicit POST confirmation.
  link.hash = new URLSearchParams({
    purpose: input.purpose,
    token: input.token,
  }).toString();
  const message = copy[input.purpose];
  return {
    subject: message.subject,
    text: `${message.instruction}\n\n${link.href}\n\nLidhja është për një përdorim dhe skadon më ${new Date(input.expiresAt).toISOString()} (UTC).\nNëse nuk e prisnit këtë mesazh, mos e përdorni lidhjen. Mos ia përcillni askujt.`,
  };
}
export function accountSecurityEmail(input: {
  origin: string;
  event: "email_changed" | "password_changed";
}): { subject: string; text: string } {
  const url = portal(input.origin);
  if (input.event !== "email_changed" && input.event !== "password_changed")
    throw new Error("INVALID_ACCOUNT_EMAIL_EVENT");
  return {
    subject: "Njoftim sigurie për llogarinë",
    text:
      (input.event === "email_changed"
        ? "Adresa e emailit të llogarisë është ndryshuar. Ky njoftim i dërgohet adresës së mëparshme."
        : "Fjalëkalimi i llogarisë është ndryshuar.") +
      `\nNëse nuk e keni autorizuar këtë veprim, kontaktoni laboratorin përmes kanalit që njihni.\n\n${url.href}`,
  };
}
