import { test, expect, vi } from "vitest";
import { createOrderReviewService } from "../../apps/api/dist/modules/orders/index.js";
import { createOrderDecisionClient } from "../../apps/web/src/features/orders/decision-api.ts";
const id = "91000000-0000-4000-8000-000000000001",
  actor = { accountId: id, sessionId: id };
const row = {
  id,
  number: "9007199254740993",
  clinic_name: "Synthetic Clinic",
  kind: "normal",
  origin: "clinic",
  status: "pending",
  revision: "2",
  version_id: id,
  patient: { internal_reference: "Synthetic" },
  requested_delivery_date: "2026-11-01",
  description: null,
  material: "Historical material",
  shade: "Historical shade",
  work_type: null,
  teeth: [{ fdi: 11, selection: "pontic" }],
  file_count: 0,
  security_block: false,
};
function fixture(patch = {}) {
  const query = vi.fn(async (sql) => {
    if (sql.startsWith("SELECT a.profile"))
      return {
        rows: patch.revoked
          ? []
          : [
              {
                profile: patch.profile ?? "owner",
                lifecycle: "active",
                sessionValid: true,
                securityLocked: false,
                resetRequired: false,
                ownerCurrent: true,
                clinicId: id,
                clinicSuspended: false,
                grants: patch.grants ?? [],
              },
            ],
      };
    if (sql.startsWith("SELECT o.id,o.number"))
      return { rows: patch.rows ?? [row] };
    return { rows: [] };
  });
  return { query, transaction: vi.fn((fn) => fn({ query })) };
}
test("review uses immutable snapshot labels and returns current version revision with no writes", async () => {
  const db = fixture(),
    r = await createOrderReviewService(db).list(actor);
  expect(r.kind).toBe("page");
  expect(r.page.items[0]).toEqual({ ...row, revision: 2 });
  const sql = db.query.mock.calls.find(([s]) =>
    s.startsWith("SELECT o.id,o.number"),
  )[0];
  expect(sql).toContain("public.catalog_reference_snapshots");
  expect(sql).not.toContain("catalog_entries");
  expect(sql).toContain("v.id=o.current_version_id");
  expect(sql).toContain("o.status IN ('pending','accepted')");
  expect(
    db.query.mock.calls.some(([s]) => /^(INSERT|UPDATE|DELETE)/.test(s)),
  ).toBe(false);
});
test("details permission prerequisites enforced, clinic/logistics-only/revoked identities receive no patient query", async () => {
  for (const patch of [
    { profile: "clinic" },
    { revoked: true },
    { profile: "employee", grants: ["orders.read_logistics"] },
    { profile: "admin", grants: ["orders.read_details"] },
  ]) {
    const db = fixture(patch);
    expect((await createOrderReviewService(db).list(actor)).kind).toBe(
      "denied",
    );
    expect(
      db.query.mock.calls.some(([s]) => s.startsWith("SELECT o.id,o.number")),
    ).toBe(false);
  }
  const db = fixture({
    profile: "employee",
    grants: ["orders.read_logistics", "orders.read_details"],
  });
  expect((await createOrderReviewService(db).list(actor)).kind).toBe("page");
});
test("pagination bounds results and rejects malformed cursors before querying", async () => {
  const rows = Array.from({ length: 51 }, (_, i) => ({
      ...row,
      id: "91000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
    })),
    db = fixture({ rows });
  const result = await createOrderReviewService(db).list(actor, id);
  expect(result.page.items).toHaveLength(50);
  expect(result.page.next_after).toBe(rows[49].id);
  expect(db.query.mock.calls.at(-1)[1]).toEqual([id]);
  const invalid = fixture();
  expect(
    (await createOrderReviewService(invalid).list(actor, [id, id])).kind,
  ).toBe("invalid");
  expect(invalid.transaction).not.toHaveBeenCalled();
});
test("review and decision client strictly validates and refuses uncertain outcomes without retry/cache", async () => {
  const transport = vi.fn(
    async () =>
      new globalThis.Response(
        JSON.stringify({ items: [{ ...row, revision: 2 }], next_after: null }),
        { status: 200 },
      ),
  );
  expect(
    (
      await createOrderDecisionClient(transport).list(
        new globalThis.AbortController().signal,
        id,
      )
    ).items[0].material,
  ).toBe("Historical material");
  expect(transport.mock.calls[0][1]).toMatchObject({
    cache: "no-store",
    redirect: "error",
    credentials: "same-origin",
  });
  const failed = vi.fn(
    async () => new globalThis.Response("{}", { status: 500 }),
  );
  await expect(
    createOrderDecisionClient(failed).decide(
      {
        order_id: id,
        expected_version_id: id,
        expected_revision: 1,
        action: "reject",
        reason: "Synthetic",
      },
      new globalThis.AbortController().signal,
    ),
  ).rejects.toThrow("ORDER_DECISION_UNCERTAIN");
  expect(failed).toHaveBeenCalledTimes(1);
});
