import { test, expect, vi } from "vitest";
import {
  createPrivateInvitationMailAppender,
  createPrivateMailCodec,
  assertPrivateInvitationMailReady,
} from "../../apps/api/dist/modules/notifications/index.js";
import { createActionToken } from "../../apps/api/dist/modules/identity/index.js";
const id = "87800000-0000-4000-8000-000000000001",
  account = "87800000-0000-4000-8000-000000000002";
const now = Date.UTC(2026, 9, 16),
  expiry = now + 60000,
  recipient = "synthetic@example.test";
function fixture(patch = {}) {
  const purpose = patch.purpose ?? "employee",
    action = purpose === "admin" ? "admin-invitation" : "employee-invitation",
    challenge = createActionToken(action);
  const row = {
    account_id: account,
    purpose,
    profile: purpose,
    lifecycle: "invited",
    security_locked: false,
    credential_reset_required: false,
    email_key: recipient,
    target_email: recipient,
    token_digest: challenge.digest,
    expires_at: new Date(expiry),
    auth_epoch: "4",
    consumed_at: null,
    revoked_at: null,
    unexpired: true,
    ...patch,
  };
  const query = vi.fn(async (sql) => {
    if (patch.fail && sql.startsWith(patch.fail))
      throw new Error("PRIVATE DATABASE DETAIL");
    if (sql.startsWith("SELECT account_id"))
      return { rows: patch.missing ? [] : [{ account_id: account }] };
    if (sql.startsWith("SELECT i.account_id"))
      return { rows: patch.changedAccount ? [] : [row] };
    return { rows: [], rowCount: patch.zeroInsert ? 0 : 1 };
  });
  const codec = createPrivateMailCodec(
    { keyId: "synthetic-v1", key: Buffer.alloc(32, 23) },
    () => now,
  );
  return {
    query,
    codec,
    append: createPrivateInvitationMailAppender(codec),
    input: {
      invitationId: id,
      token: challenge.token,
      origin: "https://dental.example.test",
      landingUrl: "https://dental.example.test/invitation",
    },
    row,
  };
}
test("employee and admin intents encrypt authoritative recipient in the supplied transaction only", async () => {
  for (const purpose of ["employee", "admin"]) {
    const f = fixture({ purpose });
    try {
      await f.append({ query: f.query }, f.input);
      const calls = f.query.mock.calls;
      expect(calls).toHaveLength(4);
      expect(calls[1][0]).toContain("FOR UPDATE");
      expect(calls[2][0]).toContain("FOR UPDATE OF i");
      const [sql, values] = calls[3];
      expect(sql).toContain("INSERT INTO public.private_invitation_mail");
      expect(sql).not.toContain("ON CONFLICT");
      expect(values.slice(0, 7)).toEqual([
        id,
        account,
        4,
        purpose + "-invitation",
        expiry,
        1,
        "synthetic-v1",
      ]);
      const envelope = {
        messageId: values[0],
        purpose: values[3],
        expiresAt: values[4],
        version: values[5],
        keyId: values[6],
        nonce: values[7].toString("base64url"),
        tag: values[8].toString("base64url"),
        ciphertext: values[9].toString("base64url"),
      };
      const payload = f.codec.open(envelope, {
        messageId: id,
        purpose: purpose + "-invitation",
        expiresAt: expiry,
      });
      expect(
        payload.recipient === recipient && payload.token === f.input.token,
      ).toBe(true);
      const serialized = JSON.stringify(calls);
      for (const secret of [recipient, f.input.token, f.input.origin])
        expect(serialized.includes(secret)).toBe(false);
      expect(
        calls.some(([s]) =>
          /BEGIN|COMMIT|ROLLBACK|notification_deliveries/.test(s),
        ),
      ).toBe(false);
    } finally {
      f.codec.close();
    }
  }
});
test("missing moved expired terminal wrong-profile suspended locked and address-mismatched invitations never enqueue", async () => {
  for (const patch of [
    { missing: true },
    { changedAccount: true },
    { unexpired: false },
    { consumed_at: new Date(now) },
    { revoked_at: new Date(now) },
    { profile: "owner" },
    { lifecycle: "active" },
    { lifecycle: "suspended" },
    { security_locked: true },
    { credential_reset_required: true },
    { email_key: "changed@example.test" },
    { auth_epoch: "-1" },
    { auth_epoch: "9007199254740992" },
    { token_digest: Buffer.alloc(32, 0) },
    { token_digest: Buffer.alloc(31, 0) },
  ]) {
    const f = fixture(patch);
    try {
      await expect(f.append({ query: f.query }, f.input)).rejects.toThrow(
        "PRIVATE_INVITATION_MAIL_FAILED",
      );
      expect(f.query.mock.calls.some(([s]) => s.startsWith("INSERT"))).toBe(
        false,
      );
    } finally {
      f.codec.close();
    }
  }
});
test("invalid and cross-purpose tokens cannot be queued and closed codec refuses before INSERT", async () => {
  const f = fixture();
  try {
    for (const token of ["x", createActionToken("password-recovery").token]) {
      await expect(
        f.append({ query: f.query }, { ...f.input, token }),
      ).rejects.toThrow("PRIVATE_INVITATION_MAIL_FAILED");
    }
    f.codec.close();
    await expect(f.append({ query: f.query }, f.input)).rejects.toThrow(
      "PRIVATE_INVITATION_MAIL_FAILED",
    );
    expect(f.query.mock.calls.some(([s]) => s.startsWith("INSERT"))).toBe(
      false,
    );
  } finally {
    f.codec.close();
  }
});
test("unique violation, absent insert and database failures reject to caller for rollback with redacted error and no retry", async () => {
  for (const patch of [
    { fail: "SELECT account_id" },
    { fail: "INSERT INTO public.private_invitation_mail" },
    { zeroInsert: true },
  ]) {
    const f = fixture(patch);
    try {
      let caught;
      try {
        await f.append({ query: f.query }, f.input);
      } catch (error) {
        caught = error;
      }
      expect(caught?.message).toBe("PRIVATE_INVITATION_MAIL_FAILED");
      expect(caught?.cause).toBeUndefined();
      expect(
        f.query.mock.calls.filter(([s]) => s.startsWith("INSERT")),
      ).toHaveLength(patch.fail === "SELECT account_id" ? 0 : 1);
    } finally {
      f.codec.close();
    }
  }
});
test("private queue readiness requires insert-only privilege without public read or update", async () => {
  for (const rows of [[], [{ ready: false }]]) {
    await expect(
      assertPrivateInvitationMailReady({ query: async () => ({ rows }) }),
    ).rejects.toThrow("NOT_READY");
  }
  const query = vi.fn(async () => ({ rows: [{ ready: true }] }));
  await assertPrivateInvitationMailReady({ query });
  expect(query.mock.calls[0][0]).toContain("'SELECT,UPDATE,DELETE,TRUNCATE'");
});
