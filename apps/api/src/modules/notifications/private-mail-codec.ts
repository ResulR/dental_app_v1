import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { emailKey } from "../identity/index.js";
import { accountChallengeEmail } from "./account-email.js";
const Purpose = z.enum([
  "email-change",
  "password-recovery",
  "employee-invitation",
  "admin-invitation",
]);
const Context = z.strictObject({
  messageId: z.uuid(),
  purpose: Purpose,
  expiresAt: z.number().int().safe().positive(),
});
const Payload = z.strictObject({
  recipient: z.string().min(1).max(320),
  token: z.string().length(43),
  origin: z.string().max(2048),
  landingUrl: z.string().max(2048),
});
const KeyId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const Envelope = Context.extend({
  version: z.literal(1),
  keyId: KeyId,
  nonce: z.string().length(16),
  tag: z.string().length(22),
  ciphertext: z.string().min(1).max(8192),
});
type MailContext = z.infer<typeof Context>;
type MailPayload = z.infer<typeof Payload>;
function decode(value: string, size?: number) {
  const decoded = Buffer.from(value, "base64url");
  if (
    !/^[A-Za-z0-9_-]+$/.test(value) ||
    decoded.toString("base64url") !== value ||
    (size !== undefined && decoded.length !== size)
  )
    throw new Error("PRIVATE_MAIL_INVALID");
  return decoded;
}
// No environment access or persistence. Keys are injected by a future private
// operator-managed worker; tests use synthetic ephemeral keys only.
export function createPrivateMailCodec(
  config: { keyId: string; key: Uint8Array },
  clock: () => number = Date.now,
) {
  if (
    !KeyId.safeParse(config.keyId).success ||
    !(config.key instanceof Uint8Array) ||
    config.key.byteLength !== 32
  )
    throw new Error("PRIVATE_MAIL_KEY_INVALID");
  const keyId = config.keyId,
    key = Buffer.from(config.key);
  let closed = false;
  function active(context: MailContext) {
    const now = clock();
    if (
      closed ||
      !Number.isSafeInteger(now) ||
      now < 0 ||
      now >= context.expiresAt ||
      !Number.isFinite(new Date(context.expiresAt).getTime())
    )
      throw new Error("PRIVATE_MAIL_UNAVAILABLE");
    return now;
  }
  function aad(context: MailContext) {
    return Buffer.from(
      JSON.stringify([
        "dental-lab/private-account-mail/v1",
        keyId,
        context.messageId,
        context.purpose,
        context.expiresAt,
      ]),
    );
  }
  function validate(payload: MailPayload, context: MailContext) {
    if (
      payload.recipient !== payload.recipient.trim() ||
      /[\r\n]/.test(payload.recipient) ||
      !emailKey(payload.recipient)
    )
      throw new Error("PRIVATE_MAIL_INVALID");
    accountChallengeEmail({ ...payload, ...context, now: active(context) });
  }
  return {
    seal(rawContext: MailContext, rawPayload: MailPayload) {
      let plaintext: Buffer | undefined;
      try {
        const context = Context.parse(rawContext),
          payload = Payload.parse(rawPayload);
        validate(payload, context);
        plaintext = Buffer.from(JSON.stringify(payload));
        if (plaintext.length > 4096) throw new Error("PRIVATE_MAIL_INVALID");
        const nonce = randomBytes(12),
          cipher = createCipheriv("aes-256-gcm", key, nonce);
        cipher.setAAD(aad(context));
        const ciphertext = Buffer.concat([
          cipher.update(plaintext),
          cipher.final(),
        ]);
        return Object.freeze(
          Envelope.parse({
            ...context,
            version: 1,
            keyId,
            nonce: nonce.toString("base64url"),
            tag: cipher.getAuthTag().toString("base64url"),
            ciphertext: ciphertext.toString("base64url"),
          }),
        );
      } catch {
        throw new Error("PRIVATE_MAIL_SEAL_FAILED");
      } finally {
        plaintext?.fill(0);
      }
    },
    open(rawEnvelope: unknown, expected: MailContext): MailPayload {
      let plaintext: Buffer | undefined;
      try {
        const envelope = Envelope.parse(rawEnvelope),
          context = Context.parse(expected);
        if (
          envelope.keyId !== keyId ||
          envelope.messageId !== context.messageId ||
          envelope.purpose !== context.purpose ||
          envelope.expiresAt !== context.expiresAt
        )
          throw new Error("PRIVATE_MAIL_INVALID");
        active(context);
        const decipher = createDecipheriv(
          "aes-256-gcm",
          key,
          decode(envelope.nonce, 12),
        );
        decipher.setAAD(aad(context));
        decipher.setAuthTag(decode(envelope.tag, 16));
        const ciphertext = decode(envelope.ciphertext);
        if (ciphertext.length > 4096) throw new Error("PRIVATE_MAIL_INVALID");
        plaintext = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]);
        const payload = Payload.parse(JSON.parse(plaintext.toString("utf8")));
        validate(payload, context);
        return payload;
      } catch {
        throw new Error("PRIVATE_MAIL_OPEN_FAILED");
      } finally {
        plaintext?.fill(0);
      }
    },
    close() {
      key.fill(0);
      closed = true;
    },
  };
}
