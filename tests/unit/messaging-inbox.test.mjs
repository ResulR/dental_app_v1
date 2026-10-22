import { test, expect, vi } from "vitest";
import { createMessagingInboxService } from "../../apps/api/dist/modules/messaging/index.js";
const id = "91000000-0000-4000-8000-000000000001";
const actor = { accountId: id, sessionId: id };
function fixture({
  profile = "employee",
  grants = ["messaging.general.read"],
  allowOrder = false,
  missing = false,
  rows = 1,
} = {}) {
  const calls = [];
  const query = vi.fn(async (sql, args = []) => {
    calls.push([sql, args]);
    if (sql.startsWith("SELECT a.profile"))
      return {
        rows: [
          {
            profile,
            lifecycle: "active",
            securityLocked: false,
            resetRequired: false,
            sessionValid: true,
            ownerCurrent: true,
            clinicId: null,
            clinicSuspended: false,
            grants,
          },
        ],
      };
    if (sql.includes("FROM public.conversations c JOIN public.clinics k"))
      return {
        rows: Array.from({ length: rows }, (_, index) => ({
          conversation_id: id,
          clinic_id: id,
          clinic_name: "Klinika",
          kind: index % 2 ? "order" : "general",
          order_id: index % 2 ? id : null,
          order_number: index % 2 ? "99" : null,
          closed_at: null,
          activity_at: new Date("2026-10-21T10:00:00.000Z"),
          last_read_seq: missing ? null : "0",
          other_side: missing ? null : "clinic",
          unread_count: "1",
        })),
      };
    return { rows: [] };
  });
  return {
    repo: createMessagingInboxService(
      { transaction: (fn) => fn({ query }) },
      allowOrder,
    ),
    calls,
  };
}
test("lab inbox composes only granted kinds, strict filters and stable cursor", async () => {
  const f = fixture({
    grants: ["orders.read_logistics", "messaging.order.read"],
    allowOrder: true,
    rows: 51,
  });
  const result = await f.repo.list(actor, {
    kind: "order",
    search: "99",
    unread_only: true,
  });
  expect(result.kind).toBe("result");
  expect(result.result.items).toHaveLength(50);
  expect(result.result.next_before_id).toBe(id);
  const call = f.calls.find(([sql]) =>
    sql.includes("FROM public.conversations c JOIN public.clinics k"),
  );
  expect(call[1].slice(0, 5)).toEqual([false, true, "99", "order", true]);
  expect(call[0]).toContain("ORDER BY activity_at DESC,c.id DESC LIMIT 51");
  expect(
    (await f.repo.list(actor, { before_at: "2026-10-21T10:00:00.000Z" })).kind,
  ).toBe("invalid");
});
test("clinic, lacking grants and missing read markers fail closed", async () => {
  expect((await fixture({ profile: "clinic" }).repo.list(actor, {})).kind).toBe(
    "denied",
  );
  expect((await fixture({ grants: [] }).repo.list(actor, {})).kind).toBe(
    "denied",
  );
  expect((await fixture({ missing: true }).repo.list(actor, {})).kind).toBe(
    "unavailable",
  );
  const f = fixture({ grants: ["messaging.order.read"], allowOrder: false });
  expect((await f.repo.list(actor, {})).kind).toBe("denied");
});
