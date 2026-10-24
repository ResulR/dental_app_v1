import { expect, test, vi } from "vitest";
import { createInternalNoticeService } from "../../apps/api/dist/modules/notifications/index.js";
import { internalNoticesEnabled } from "../../apps/api/dist/app/internal-notices-config.js";
const id = "91000000-0000-4000-8000-000000000001";
const clinic = "91000000-0000-4000-8000-000000000002";
const actor = { accountId: id, sessionId: id };
function fixture({
  profile = "owner",
  missing = false,
  fail = false,
  alreadyRead = false,
  kind = "clinic_registered",
  revoked = false,
  suspended = false,
  grants = [],
} = {}) {
  const calls = [];
  const readAt = new Date("2026-10-22T12:00:00.000Z");
  const query = vi.fn(async (sql, args = []) => {
    calls.push([sql, args]);
    if (fail && sql.includes("UPDATE public.internal_notifications"))
      throw new Error("database failure");
    if (sql.startsWith("SELECT a.profile"))
      return {
        rows: [
          {
            profile,
            lifecycle: revoked ? "suspended" : "active",
            securityLocked: false,
            resetRequired: false,
            sessionValid: true,
            ownerCurrent: profile === "owner",
            clinicId: profile === "clinic" ? clinic : null,
            clinicSuspended: suspended,
            grants,
          },
        ],
      };
    if (
      sql.startsWith(
        "SELECT id FROM public.clinics WHERE account_id=$1 AND review_state",
      )
    )
      return { rows: suspended ? [] : [{ id: clinic }] };
    if (sql.startsWith("SELECT count(*)::text AS unread"))
      return { rows: [{ unread: "1" }] };
    if (sql.startsWith("SELECT n.id,e.type AS kind"))
      return {
        rows: [
          {
            id,
            kind,
            clinic_id: clinic,
            order_id:
              kind === "clinic_registered" || kind === "message_created"
                ? null
                : id,
            conversation_id: kind === "message_created" ? id : null,
            clinic_name: "Klinika",
            clinic_revision: "2",
            created_at: readAt,
            read_at: null,
          },
        ],
      };
    if (sql.startsWith("SELECT n.read_at FROM"))
      return {
        rows: missing ? [] : [{ read_at: alreadyRead ? readAt : null }],
      };
    if (sql.startsWith("UPDATE public.internal_notifications"))
      return { rows: [{ read_at: readAt }] };
    return { rows: [] };
  });
  return {
    service: createInternalNoticeService({
      transaction: async (work) => work({ query }),
    }),
    calls,
  };
}
test("internal notices remain disabled unless explicitly enabled with registration", () => {
  expect(internalNoticesEnabled({})).toBe(false);
  expect(
    internalNoticesEnabled({ DENTAL_LAB_INTERNAL_NOTICES_ENABLED: "false" }),
  ).toBe(false);
  expect(() =>
    internalNoticesEnabled({ DENTAL_LAB_INTERNAL_NOTICES_ENABLED: "true" }),
  ).toThrow();
  expect(() =>
    internalNoticesEnabled({
      DENTAL_LAB_INTERNAL_NOTICES_ENABLED: "yes",
      DENTAL_LAB_REGISTRATION_ENABLED: "true",
    }),
  ).toThrow();
  expect(
    internalNoticesEnabled({
      DENTAL_LAB_INTERNAL_NOTICES_ENABLED: "true",
      DENTAL_LAB_REGISTRATION_ENABLED: "true",
    }),
  ).toBe(true);
  expect(() =>
    internalNoticesEnabled({
      DENTAL_LAB_INTERNAL_NOTICES_ENABLED: "true",
      DENTAL_LAB_REGISTRATION_ENABLED: "true",
      DENTAL_LAB_ORDER_SUBMISSION_ENABLED: "true",
    }),
  ).toThrow("ORDER_NOTICES_DESTINATION_UNAVAILABLE");
  expect(
    internalNoticesEnabled({
      DENTAL_LAB_INTERNAL_NOTICES_ENABLED: "true",
      DENTAL_LAB_REGISTRATION_ENABLED: "true",
      DENTAL_LAB_ORDER_SUBMISSION_ENABLED: "true",
      DENTAL_LAB_ORDER_TRACKING_ENABLED: "true",
      DENTAL_LAB_ORDER_DECISION_ENABLED: "true",
    }),
  ).toBe(true);
  expect(() =>
    internalNoticesEnabled({
      DENTAL_LAB_INTERNAL_NOTICES_ENABLED: "true",
      DENTAL_LAB_REGISTRATION_ENABLED: "true",
      DENTAL_LAB_GENERAL_MESSAGING_ENABLED: "true",
      DENTAL_LAB_ORDER_MESSAGING_ENABLED: "true",
    }),
  ).toThrow("MESSAGE_NOTICES_DESTINATION_UNAVAILABLE");
  for (const feature of [
    "ORDER_REQUEST",
    "ORDER_EDIT",
    "ORDER_MODIFICATION",
    "RETOUCH",
  ]) {
    expect(() =>
      internalNoticesEnabled({
        DENTAL_LAB_INTERNAL_NOTICES_ENABLED: "true",
        DENTAL_LAB_REGISTRATION_ENABLED: "true",
        [`DENTAL_LAB_${feature}_ENABLED`]: "true",
      }),
    ).toThrow("ORDER_NOTICES_DESTINATION_UNAVAILABLE");
  }
});
test("owner list is scoped to recipient and registration event with unread count and cursor", async () => {
  const f = fixture();
  const result = await f.service.list(actor, {});
  expect(result.kind).toBe("result");
  expect(result.result.unread_count).toBe(1);
  expect(result.result.items[0].clinic_id).toBe(clinic);
  const select = f.calls.find(([sql]) =>
    sql.startsWith("SELECT n.id,e.type AS kind"),
  );
  expect(select[0]).toContain("n.target_account_id=$1");
  expect(select[0]).toContain("e.type='clinic_registered'");
  expect(select[0]).toContain("e.type='message_created'");
  expect(select[0]).toContain("m.sender_id<>$1");
  expect(select[0]).toContain("v.kind='order' AND mo.id IS NOT NULL");
  for (const kind of [
    "order_submitted",
    "correction_resubmitted",
    "cancellation_requested",
    "modification_requested",
    "retouch_requested",
  ])
    expect(select[0]).toContain(kind);
  const orderNotice = await fixture({ kind: "order_submitted" }).service.list(
    actor,
    {},
  );
  expect(orderNotice.result.items[0]).toMatchObject({
    kind: "order_submitted",
    order_id: id,
  });
  for (const kind of [
    "correction_resubmitted",
    "cancellation_requested",
    "modification_requested",
    "retouch_requested",
  ]) {
    const related = await fixture({ kind }).service.list(actor, {});
    expect(related.result.items[0]).toMatchObject({ kind, order_id: id });
  }
  expect(select[0]).toContain("ORDER BY n.created_at DESC,n.id DESC LIMIT 51");
  expect(select[1][0]).toBe(id);
  expect((await f.service.list(actor, { before_id: id })).kind).toBe("invalid");
});
test("owner read is idempotently scoped; clinic and foreign notification denied", async () => {
  const f = fixture();
  expect((await f.service.markRead(actor, { id })).result.read_at).toBe(
    "2026-10-22T12:00:00.000Z",
  );
  const update = f.calls.find(([sql]) =>
    sql.startsWith("UPDATE public.internal_notifications"),
  );
  expect(update[0]).toContain("target_account_id=$2 AND read_at IS NULL");
  expect(update[1]).toEqual([id, id]);
  const replay = fixture({ alreadyRead: true });
  expect((await replay.service.markRead(actor, { id })).result.read_at).toBe(
    "2026-10-22T12:00:00.000Z",
  );
  expect(
    replay.calls.some(([sql]) =>
      sql.startsWith("UPDATE public.internal_notifications"),
    ),
  ).toBe(false);
  expect(
    (
      await fixture({ profile: "clinic", suspended: true }).service.list(
        actor,
        {},
      )
    ).kind,
  ).toBe("denied");
  expect(
    (await fixture({ missing: true }).service.markRead(actor, { id })).kind,
  ).toBe("denied");
  await expect(
    fixture({ fail: true }).service.markRead(actor, { id }),
  ).rejects.toThrow("database failure");
});

test("message notices remain per recipient, scoped by current permission and conversation", async () => {
  const general = fixture({
    profile: "employee",
    kind: "message_created",
    grants: ["messaging.general.read"],
  });
  const result = await general.service.list(actor, {});
  expect(result.result.items[0]).toMatchObject({
    kind: "message_created",
    conversation_id: id,
  });
  const select = general.calls.find(([sql]) =>
    sql.startsWith("SELECT n.id,e.type AS kind"),
  );
  const count = general.calls.find(([sql]) =>
    sql.startsWith("SELECT count(*)::text AS unread"),
  );
  expect(select[1]).toEqual([id, false, true, true, false, null, null]);
  expect(count[1]).toEqual([id, false, true, true, false]);
  expect(select[0]).toContain("c.account_id=$1");
  expect(select[0]).toContain("m.sender_side='clinic'");
  expect(select[0]).toContain("m.sender_side='laboratory'");
  expect(select[0]).toContain("c.review_state='approved'");
  expect(select[0]).toContain("m.sender_id<>$1");
  const clinicNotice = fixture({ profile: "clinic", kind: "message_created" });
  expect((await clinicNotice.service.list(actor, {})).kind).toBe("result");
  expect(
    (
      await fixture({ revoked: true, kind: "message_created" }).service.list(
        actor,
        {},
      )
    ).kind,
  ).toBe("denied");
  const read = await general.service.markRead(actor, { id });
  expect(read.kind).toBe("result");
  expect(
    general.calls.some(([sql]) =>
      /UPDATE public.conversation_reads|UPDATE public.messages/.test(sql),
    ),
  ).toBe(false);
  expect(
    general.calls.find(([sql]) => sql.startsWith("SELECT n.read_at"))[1],
  ).toEqual([id, false, true, true, false, id]);
});
