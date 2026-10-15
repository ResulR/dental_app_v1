import { expect, test } from "vitest";
import {
  accountChallengeEmail,
  accountSecurityEmail,
} from "../../apps/api/dist/modules/notifications/index.js";
import {
  createActionToken,
  createPasswordRecoveryService,
} from "../../apps/api/dist/modules/identity/index.js";
const now = Date.UTC(2026, 0, 1);
const input = {
  purpose: "password-recovery",
  token: Buffer.alloc(32, 1).toString("base64url"),
  origin: "https://portal.example",
  landingUrl: "https://portal.example/receiving-page",
  now,
  expiresAt: now + 60000,
};
test("all four purposes render Albanian copy and token only in fragment", () => {
  const subjects = new Set();
  for (const purpose of [
    "email-change",
    "password-recovery",
    "employee-invitation",
    "admin-invitation",
  ]) {
    const message = accountChallengeEmail({ ...input, purpose });
    subjects.add(message.subject);
    const link = new URL(message.text.split("\n\n")[1]);
    expect(link.origin).toBe(input.origin);
    expect(link.search).toBe("");
    expect(link.pathname).not.toContain(input.token);
    expect(
      new globalThis.URLSearchParams(link.hash.slice(1)).get("token"),
    ).toBe(input.token);
    expect(
      new globalThis.URLSearchParams(link.hash.slice(1)).get("purpose"),
    ).toBe(purpose);
    expect(message.text).toContain("2026-01-01T00:01:00.000Z");
  }
  expect(subjects.size).toBe(4);
});
test("invalid or expired challenges fail closed without reflected secret", () => {
  for (const patch of [
    { purpose: "unknown" },
    { purpose: "__proto__" },
    { token: "secret-invalid" },
    { expiresAt: now },
    { expiresAt: NaN },
    { expiresAt: 1e16 },
    { now: -1 },
    { now: undefined },
  ]) {
    expect(() => accountChallengeEmail({ ...input, ...patch })).toThrow(
      /^INVALID_ACCOUNT_EMAIL_/,
    );
  }
});
test("origin and receiving URL reject cross-origin, credentials, query and normalization", () => {
  for (const landingUrl of [
    `https://portal.example/${input.token}`,
    "http://portal.example/x",
    "https://evil.example/x",
    "https://u:p@portal.example/x",
    "https://portal.example/x?token=secret",
    "https://portal.example/x#old",
    "https://portal.example/x?",
    "https://portal.example/x#",
    "https://portal.example/a/../x",
    "https://portal.example/x\n",
  ]) {
    expect(() => accountChallengeEmail({ ...input, landingUrl })).toThrow();
  }
  for (const origin of [
    "http://portal.example",
    "https://portal.example/",
    "https://portal.example/path",
    "https://u:p@portal.example",
  ]) {
    expect(() => accountChallengeEmail({ ...input, origin })).toThrow();
    expect(() =>
      accountSecurityEmail({ origin, event: "email_changed" }),
    ).toThrow();
  }
});
test("security notices have no challenge or replacement address", () => {
  for (const event of ["email_changed", "password_changed"]) {
    const message = accountSecurityEmail({ origin: input.origin, event });
    expect(message.text).toContain(input.origin);
    expect(message.text).not.toContain(input.token);
    expect(message.text).not.toContain("token=");
  }
  expect(() =>
    accountSecurityEmail({ origin: input.origin, event: "unknown" }),
  ).toThrow();
});
test("recovery port can prepare message without exposing token in public result", async () => {
  const prepared = [];
  const service = createPasswordRecoveryService(
    {
      admit: () => true,
      enqueueAtomic: async (challenge) => {
        prepared.push(accountChallengeEmail({ ...input, ...challenge }));
      },
      findByDigest: async () => null,
      resetAtomic: async () => "denied",
    },
    { tokenLifetimeMs: 60000 },
    () => now,
  );
  expect(
    await service.request("synthetic@example.test", "synthetic-network"),
  ).toEqual({ kind: "accepted" });
  expect(prepared).toHaveLength(1);
  expect(prepared[0].text).toContain("Rivendosja".toLowerCase().slice(0, 6));
});
test("existing canonical token helper is reused", () => {
  const challenge = createActionToken("employee-invitation");
  expect(
    accountChallengeEmail({
      ...input,
      ...challenge,
      purpose: "employee-invitation",
    }).text,
  ).toContain(challenge.token);
  expect(() =>
    accountChallengeEmail({ ...input, token: input.token.slice(0, -1) + "B" }),
  ).toThrow();
});
