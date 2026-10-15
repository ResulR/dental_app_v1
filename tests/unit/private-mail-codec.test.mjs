import { test, expect } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import {
  createPrivateMailCodec,
  accountChallengeEmail,
} from "../../apps/api/dist/modules/notifications/index.js";
const now = Date.UTC(2026, 0, 1);
const context = {
  messageId: randomUUID(),
  purpose: "password-recovery",
  expiresAt: now + 60000,
};
const payload = {
  recipient: "synthetic@example.test",
  token: Buffer.alloc(32, 7).toString("base64url"),
  origin: "https://portal.example",
  landingUrl: "https://portal.example/receiving-page",
};
const make = (
  key = randomBytes(32),
  clock = () => now,
  keyId = "synthetic-v1",
) => createPrivateMailCodec({ key, keyId }, clock);
test("private intent roundtrip composes with Albanian renderer and ciphertext has no plaintext secrets", () => {
  const codec = make();
  try {
    const sealed = codec.seal(context, payload);
    expect(codec.open(sealed, context)).toEqual(payload);
    expect(JSON.stringify(sealed)).not.toContain(payload.token);
    expect(JSON.stringify(sealed)).not.toContain(payload.recipient);
    expect(
      accountChallengeEmail({ ...codec.open(sealed, context), ...context, now })
        .subject,
    ).toBe("Rivendosja e fjalëkalimit");
  } finally {
    codec.close();
  }
});
test("same intent uses a fresh random nonce and different ciphertext", () => {
  const codec = make();
  try {
    const a = codec.seal(context, payload),
      b = codec.seal(context, payload);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(codec.open(a, context)).toEqual(codec.open(b, context));
  } finally {
    codec.close();
  }
});
test("authentication rejects changes to ciphertext, tag, nonce and every bound metadata field", () => {
  const codec = make();
  try {
    const sealed = codec.seal(context, payload);
    for (const patch of [
      { ciphertext: "A" + sealed.ciphertext.slice(1) },
      { tag: "A" + sealed.tag.slice(1) },
      { nonce: "A" + sealed.nonce.slice(1) },
      { keyId: "other" },
      { messageId: randomUUID() },
      { purpose: "admin-invitation" },
      { expiresAt: context.expiresAt + 1 },
      { version: 2 },
      { extra: true },
    ]) {
      // Ensure synthetic corruption always changes the value even if its first byte is A.
      for (const name of ["ciphertext", "tag", "nonce"])
        if (patch[name] === sealed[name])
          patch[name] = "B" + sealed[name].slice(1);
      expect(() => codec.open({ ...sealed, ...patch }, context)).toThrow(
        "PRIVATE_MAIL_OPEN_FAILED",
      );
    }
    const changed = { ...context, purpose: "admin-invitation" };
    expect(() => codec.open({ ...sealed, ...changed }, changed)).toThrow(
      "PRIVATE_MAIL_OPEN_FAILED",
    );
  } finally {
    codec.close();
  }
});
test("whole valid envelope cannot be substituted for another row", () => {
  const codec = make();
  try {
    const sealed = codec.seal(context, payload);
    expect(() =>
      codec.open(sealed, { ...context, messageId: randomUUID() }),
    ).toThrow();
  } finally {
    codec.close();
  }
});
test("wrong key, wrong key version and noncanonical encoding are rejected", () => {
  const codec = make(),
    other = make();
  try {
    const sealed = codec.seal(context, payload);
    expect(() => other.open(sealed, context)).toThrow();
    for (const patch of [
      { tag: sealed.tag + "=" },
      { nonce: "!".repeat(16) },
      { ciphertext: "A".repeat(8193) },
    ])
      expect(() => codec.open({ ...sealed, ...patch }, context)).toThrow();
  } finally {
    codec.close();
    other.close();
  }
});
test("expiration at equality, invalid clocks and closed codec are fail-closed", () => {
  let time = now;
  const codec = make(undefined, () => time);
  const sealed = codec.seal(context, payload);
  time = context.expiresAt;
  expect(() => codec.open(sealed, context)).toThrow();
  expect(() => codec.seal(context, payload)).toThrow();
  time = NaN;
  expect(() => codec.open(sealed, context)).toThrow();
  time = now;
  codec.close();
  expect(() => codec.open(sealed, context)).toThrow();
  expect(() => codec.seal(context, payload)).toThrow();
});
test("payload rejects header injection, malformed tokens, cross-origin links and unknown fields", () => {
  const codec = make();
  try {
    for (const patch of [
      { recipient: "a@example.test\r\nBcc:b@example.test" },
      { recipient: "invalid" },
      { token: "secret" },
      { landingUrl: "https://evil.example/x" },
      { password: "never-store" },
    ])
      expect(() => codec.seal(context, { ...payload, ...patch })).toThrow(
        "PRIVATE_MAIL_SEAL_FAILED",
      );
  } finally {
    codec.close();
  }
});
test("key material is copied, mandatory and never silently generated", () => {
  for (const config of [
    { keyId: "v1", key: Buffer.alloc(31) },
    { keyId: "", key: Buffer.alloc(32) },
    { keyId: "v1", key: undefined },
  ])
    expect(() => createPrivateMailCodec(config)).toThrow(
      "PRIVATE_MAIL_KEY_INVALID",
    );
  const key = randomBytes(32),
    codec = make(key);
  key.fill(0);
  const sealed = codec.seal(context, payload);
  expect(codec.open(sealed, context)).toEqual(payload);
  codec.close();
});
