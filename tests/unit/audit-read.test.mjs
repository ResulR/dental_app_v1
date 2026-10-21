import { test, expect, vi } from "vitest";
import { createAuditReadRepository } from "../../apps/api/dist/modules/audit/index.js";
import { auditReadEnabled } from "../../apps/api/dist/app/audit-read-config.js";
const id = "94000000-0000-4000-8000-000000000001";
const actor = { accountId: id, sessionId: id };
const row = {
  id,
  occurred_at: new Date("2026-10-21T10:00:00Z"),
  actor_id: id,
  process_code: null,
  action: "ORDER_DELIVERED",
  object_type: "order",
  object_id: id,
  request_id: id,
  aggregate_revision: "2",
  reason_code: null,
  changed_fields: ["status"],
};
function fixture(profile = "owner", count = 1) {
  const query = vi.fn(async (sql) => {
    if (sql.startsWith("SELECT a.profile"))
      return {
        rows: [
          {
            profile,
            lifecycle: "active",
            sessionValid: true,
            securityLocked: false,
            resetRequired: false,
            ownerCurrent: profile === "owner",
            clinicId: null,
            clinicSuspended: false,
            grants: [],
          },
        ],
      };
    if (sql.startsWith("SELECT id,occurred_at,actor_id"))
      return {
        rows: Array.from({ length: count }, (_, i) => ({
          ...row,
          id: "94000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
        })),
      };
    return { rows: [] };
  });
  return { query, transaction: vi.fn((fn) => fn({ query })) };
}
test("only current owner reads bounded audit metadata with stable cursor and bound filters", async () => {
  const db = fixture("owner", 51);
  const service = createAuditReadRepository(db);
  const output = await service.page(actor, {
    action: "ORDER_DELIVERED",
    object_type: "order",
  });
  expect(output.kind).toBe("result");
  expect(output.result.items).toHaveLength(50);
  expect(output.result.next_before).toEqual({
    occurred_at: "2026-10-21T10:00:00.000Z",
    id: "94000000-0000-4000-8000-000000000050",
  });
  const q = db.query.mock.calls.find(([s]) =>
    s.startsWith("SELECT id,occurred_at,actor_id"),
  );
  expect(q[0]).toContain("(occurred_at,id)<($3::timestamptz,$4::uuid)");
  expect(q[1]).toEqual(["ORDER_DELIVERED", "order", null, null]);
  expect(
    db.query.mock.calls.some(([s]) => /^(UPDATE|DELETE|INSERT)/.test(s)),
  ).toBe(false);
  await service.page(actor, { before: output.result.next_before });
  expect(
    db.query.mock.calls.filter(([s]) =>
      s.startsWith("SELECT id,occurred_at,actor_id"),
    )[1][1][2],
  ).toBe("2026-10-21T10:00:00.000Z");
});
test.each(["admin", "employee", "clinic"])(
  "global audit refuses %s, even before selecting events",
  async (profile) => {
    const db = fixture(profile);
    expect((await createAuditReadRepository(db).page(actor, {})).kind).toBe(
      "denied",
    );
    expect(
      db.query.mock.calls.some(([s]) => s.includes("FROM public.audit_events")),
    ).toBe(false);
  },
);
test("strict query and activation gate reject unknown filters", async () => {
  const db = fixture();
  expect(
    (await createAuditReadRepository(db).page(actor, { clinic_id: id })).kind,
  ).toBe("invalid");
  expect(db.transaction).not.toHaveBeenCalled();
  expect(auditReadEnabled({})).toBe(false);
  expect(auditReadEnabled({ DENTAL_LAB_AUDIT_READ_ENABLED: "true" })).toBe(
    true,
  );
  expect(() =>
    auditReadEnabled({ DENTAL_LAB_AUDIT_READ_ENABLED: "yes" }),
  ).toThrow();
});
