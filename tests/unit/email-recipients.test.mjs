import { test, expect, vi } from "vitest";
import { createEmailRecipientsRepository } from "../../apps/api/dist/modules/notifications/email-recipients.repository.js";
import { emailRecipientsEnabled } from "../../apps/api/dist/app/email-recipients-config.js";
const owner = "94000000-0000-4000-8000-000000000001";
const admin = "94000000-0000-4000-8000-000000000002";
const actor = { accountId: owner, sessionId: owner };
function fixture({
  profile = "owner",
  present = false,
  grants = true,
  active = true,
} = {}) {
  const query = vi.fn(async (sql) => {
    if (sql.startsWith("SELECT a.profile"))
      return {
        rows: [
          {
            profile,
            lifecycle: "active",
            securityLocked: false,
            resetRequired: false,
            ownerCurrent: profile === "owner",
            grants: [],
            sessionValid: true,
          },
        ],
      };
    if (sql.includes("FROM public.accounts WHERE id=$1 AND profile='admin'"))
      return {
        rows: [
          {
            lifecycle: active ? "active" : "suspended",
            security_locked: false,
            credential_reset_required: false,
          },
        ],
      };
    if (
      sql.includes(
        "FROM public.email_category_recipients WHERE account_id=$1 AND category=$2",
      )
    )
      return { rows: present ? [{ "?column?": 1 }] : [] };
    if (sql.includes("FROM public.email_category_recipients WHERE account_id="))
      return { rows: present ? [{ category: "order_submitted" }] : [] };
    if (sql.includes("FROM public.account_grants WHERE account_id=$1"))
      return { rows: grants ? [{ "?column?": 1 }] : [] };
    if (sql.startsWith("SELECT id FROM public.sessions"))
      return { rows: [{ id: owner }] };
    return { rows: [] };
  });
  return { query, transaction: vi.fn((fn) => fn({ query })) };
}
test("owner may select a currently eligible admin category once, with audit", async () => {
  const db = fixture();
  const repo = createEmailRecipientsRepository(db);
  expect(
    await repo.change(actor, admin, "order_submitted", false, true),
  ).toEqual({ kind: "applied" });
  const sql = db.query.mock.calls.map(([statement]) => statement).join("\n");
  expect(sql).toContain("pg_advisory_xact_lock");
  expect(sql).toContain("INSERT INTO public.email_category_recipients");
  expect(sql).toContain("INSERT INTO public.audit_events");
  expect(sql).not.toContain("notification_deliveries");
});
test("stale selection cannot add a duplicate or undo another owner action", async () => {
  const db = fixture({ present: true });
  expect(
    await createEmailRecipientsRepository(db).change(
      actor,
      admin,
      "order_submitted",
      false,
      true,
    ),
  ).toEqual({ kind: "conflict" });
  expect(
    db.query.mock.calls.some(([sql]) =>
      sql.startsWith("INSERT INTO public.audit_events"),
    ),
  ).toBe(false);
});
test("owner can remove category even after admin suspension, without deleting history", async () => {
  const db = fixture({ present: true, active: false });
  expect(
    await createEmailRecipientsRepository(db).change(
      actor,
      admin,
      "order_submitted",
      true,
      false,
    ),
  ).toEqual({ kind: "applied" });
  expect(
    db.query.mock.calls.some(([sql]) =>
      sql.startsWith("DELETE FROM public.email_category_recipients"),
    ),
  ).toBe(true);
});
test("non-owner and insufficient detail grants cannot configure deliveries", async () => {
  const denied = fixture({ profile: "admin" });
  expect(
    (await createEmailRecipientsRepository(denied).list(actor, admin)).kind,
  ).toBe("denied");
  expect(
    denied.query.mock.calls.some(([sql]) =>
      sql.includes("SELECT category FROM public.email_category_recipients"),
    ),
  ).toBe(false);
  const missing = fixture({ grants: false });
  expect(
    (
      await createEmailRecipientsRepository(missing).change(
        actor,
        admin,
        "order_submitted",
        false,
        true,
      )
    ).kind,
  ).toBe("denied");
  expect(
    missing.query.mock.calls.some(([sql]) =>
      sql.startsWith("INSERT INTO public.email_category_recipients"),
    ),
  ).toBe(false);
  expect(emailRecipientsEnabled({})).toBe(false);
  expect(() =>
    emailRecipientsEnabled({ DENTAL_LAB_EMAIL_RECIPIENTS_ENABLED: "yes" }),
  ).toThrow();
});
