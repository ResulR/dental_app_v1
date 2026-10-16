import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { DatabaseExecutor } from "../../shared/database.js";
import { actionTokenDigest, emailKey } from "../identity/index.js";
import type { createPrivateMailCodec } from "./private-mail-codec.js";
const Input = z.strictObject({
  invitationId: z.uuid(),
  token: z.string().length(43),
  origin: z.string().max(2048),
  landingUrl: z.string().max(2048),
});
type Input = z.infer<typeof Input>;
// Caller supplies its already active transaction and keeps issuance/account/audit
// writes in that transaction. This helper never BEGINs, COMMITs, retries or sends.
// The codec/key and trusted canonical URLs are injected by the future issuer,
// never taken from an HTTP body. No runtime caller is activated here.
export function createPrivateInvitationMailAppender(
  codec: Pick<ReturnType<typeof createPrivateMailCodec>, "seal">,
) {
  return async (tx: DatabaseExecutor, raw: Input): Promise<void> => {
    try {
      const input = Input.parse(raw);
      const lookup = await tx.query<{ account_id: string }>(
        "SELECT account_id FROM public.invitations WHERE id=$1",
        [input.invitationId],
      );
      if (lookup.rows.length !== 1) throw new Error("UNAVAILABLE");
      const accountId = lookup.rows[0]!.account_id;
      await tx.query("SELECT id FROM public.accounts WHERE id=$1 FOR UPDATE", [
        accountId,
      ]);
      const result = await tx.query<{
        account_id: string;
        purpose: "employee" | "admin";
        profile: string;
        lifecycle: string;
        security_locked: boolean;
        credential_reset_required: boolean;
        email_key: string;
        target_email: string;
        token_digest: Buffer;
        expires_at: Date;
        auth_epoch: string;
        consumed_at: Date | null;
        revoked_at: Date | null;
        unexpired: boolean;
      }>(
        `SELECT i.account_id,i.purpose,i.target_email,i.token_digest,i.expires_at,i.consumed_at,i.revoked_at,
    a.profile,a.lifecycle,a.security_locked,a.credential_reset_required,a.email_key,a.auth_epoch::text,
    i.expires_at>clock_timestamp() AS unexpired
    FROM public.invitations i JOIN public.accounts a ON a.id=i.account_id
    WHERE i.id=$1 AND i.account_id=$2 FOR UPDATE OF i`,
        [input.invitationId, accountId],
      );
      const row = result.rows.length === 1 ? result.rows[0] : undefined;
      if (
        !row ||
        (row.purpose !== "employee" && row.purpose !== "admin") ||
        row.profile !== row.purpose ||
        row.lifecycle !== "invited" ||
        row.security_locked !== false ||
        row.credential_reset_required !== false ||
        row.consumed_at !== null ||
        row.revoked_at !== null ||
        row.unexpired !== true ||
        emailKey(row.target_email) !== row.email_key
      )
        throw new Error("UNAVAILABLE");
      const purpose =
        row.purpose === "employee" ? "employee-invitation" : "admin-invitation";
      const digest = actionTokenDigest(purpose, input.token);
      if (
        !digest ||
        !Buffer.isBuffer(row.token_digest) ||
        row.token_digest.length !== 32 ||
        !timingSafeEqual(digest, row.token_digest)
      )
        throw new Error("UNAVAILABLE");
      const expiresAt = row.expires_at.getTime(),
        epoch = Number(row.auth_epoch);
      if (
        !Number.isSafeInteger(expiresAt) ||
        expiresAt <= 0 ||
        !Number.isSafeInteger(epoch) ||
        epoch < 0
      )
        throw new Error("UNAVAILABLE");
      const envelope = codec.seal(
        { messageId: input.invitationId, purpose, expiresAt },
        {
          recipient: row.target_email,
          token: input.token,
          origin: input.origin,
          landingUrl: input.landingUrl,
        },
      );
      const inserted = await tx.query(
        "INSERT INTO public.private_invitation_mail(message_id,account_id,auth_epoch,purpose,expires_at_ms,version,key_id,nonce,tag,ciphertext) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          input.invitationId,
          row.account_id,
          epoch,
          envelope.purpose,
          envelope.expiresAt,
          envelope.version,
          envelope.keyId,
          Buffer.from(envelope.nonce, "base64url"),
          Buffer.from(envelope.tag, "base64url"),
          Buffer.from(envelope.ciphertext, "base64url"),
        ],
      );
      if (inserted.rowCount !== 1) throw new Error("UNAVAILABLE");
    } catch {
      // No database error detail, email, token, URL or crypto payload escapes.
      throw new Error("PRIVATE_INVITATION_MAIL_FAILED");
    }
  };
}
export async function assertPrivateInvitationMailReady(
  database: DatabaseExecutor,
) {
  const result = await database.query<{ ready: boolean }>(
    `SELECT has_table_privilege(current_user,'public.private_invitation_mail','INSERT') AND NOT has_table_privilege(current_user,'public.private_invitation_mail','SELECT,UPDATE,DELETE,TRUNCATE') AS ready`,
  );
  if (result.rows[0]?.ready !== true)
    throw new Error("PRIVATE_INVITATION_MAIL_NOT_READY");
}
