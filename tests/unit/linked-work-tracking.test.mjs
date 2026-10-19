import { test, expect, vi } from "vitest";
import { createLinkedWorkTrackingService } from "../../apps/api/dist/modules/linked-works/index.js";
import { createLinkedWorkClient } from "../../apps/web/src/features/orders/linked-work-api.ts";
const id = "94000000-0000-4000-8000-000000000001",
  child = "94000000-0000-4000-8000-000000000002",
  actor = { accountId: id, sessionId: id };
const order = { id, number: "1", status: "delivered" },
  link = {
    id,
    kind: "retouch",
    intervention_kind: "remanufacture",
    source: order,
    child: { id: child, number: "2", status: "pending" },
    created_at: new Date("2026-10-19T12:00:00Z"),
  };
function fixture(patch = {}) {
  const calls = [];
  const query = async (sql, values = []) => {
    calls.push([sql, values]);
    if (sql.startsWith("SELECT a.profile"))
      return {
        rows: patch.revoked
          ? []
          : [
              {
                profile: patch.profile ?? "clinic",
                lifecycle: "active",
                sessionValid: true,
                securityLocked: false,
                resetRequired: false,
                ownerCurrent: patch.ownerCurrent ?? true,
                clinicId: id,
                clinicSuspended: patch.suspended ?? false,
                grants: patch.grants ?? [],
              },
            ],
      };
    if (sql.startsWith("SELECT id FROM public.clinics WHERE account_id=$1 AND"))
      return { rows: patch.unapproved ? [] : [{ id }] };
    if (sql.startsWith("SELECT id,number::text,status"))
      return {
        rows: patch.foreign ? [] : [values[0] === child ? link.child : order],
      };
    if (sql.startsWith("SELECT w.id")) return { rows: patch.rows ?? [link] };
    return { rows: [] };
  };
  return { calls, transaction: vi.fn(async (fn) => fn({ query })) };
}
test("same clinic links expose source and child in both directions, no patient/version/file data", async () => {
  const db = fixture(),
    service = createLinkedWorkTrackingService(db);
  for (const order_id of [id, child]) {
    const r = await service.list(actor, { order_id });
    expect(r.result.items[0]).toMatchObject({
      source: order,
      child: link.child,
      kind: "retouch",
      intervention_kind: "remanufacture",
    });
    expect(r.result.order.id).toBe(order_id);
    expect(r.result.can_read_details).toBe(true);
  }
  const queries = db.calls.filter(([s]) => s.startsWith("SELECT w.id"));
  expect(queries.map(([, v]) => v)).toEqual([
    [id, id, null],
    [child, id, null],
  ]);
  expect(queries[0][0]).toContain("s.clinic_id=w.clinic_id");
  expect(queries[0][0]).toContain("c.clinic_id=w.clinic_id");
  expect(queries[0][0]).toContain(
    "w.source_order_id=$1 OR w.child_order_id=$1",
  );
  expect(queries[0][0]).not.toMatch(/patient|description|order_versions|files/);
  expect(db.calls.some(([s]) => /^(INSERT|UPDATE|DELETE)/.test(s))).toBe(false);
});
test("denied scope and revoked/suspended/unapproved identities cannot enumerate links", async () => {
  for (const patch of [
    { foreign: true },
    { revoked: true },
    { unapproved: true },
    { suspended: true },
    { profile: "employee" },
    { profile: "owner", ownerCurrent: false },
  ]) {
    const db = fixture(patch);
    expect(
      (await createLinkedWorkTrackingService(db).list(actor, { order_id: id }))
        .kind,
    ).toBe("denied");
    expect(db.calls.some(([s]) => s.startsWith("SELECT w.id"))).toBe(false);
  }
});
test("logistics permission shows chain without enabling patient details; bounded cursor and strict query", async () => {
  const rows = Array.from({ length: 51 }, (_, i) => ({
    ...link,
    id: `94000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  }));
  const db = fixture({
    profile: "employee",
    grants: ["orders.read_logistics"],
    rows,
  });
  const service = createLinkedWorkTrackingService(db);
  const r = await service.list(actor, { order_id: id, after: child });
  expect(r.result.can_read_details).toBe(false);
  expect(r.result.items).toHaveLength(50);
  expect(r.result.next_after).toBe(rows[49].id);
  expect(db.calls.find(([s]) => s.startsWith("SELECT w.id"))[1]).toEqual([
    id,
    null,
    child,
  ]);
  expect(db.calls.find(([s]) => s.startsWith("SELECT w.id"))[0]).toContain(
    "ORDER BY w.id LIMIT 51",
  );
  const invalid = fixture();
  expect(
    (
      await createLinkedWorkTrackingService(invalid).list(actor, {
        order_id: id,
        clinic_id: child,
      })
    ).kind,
  ).toBe("invalid");
  expect(invalid.transaction).not.toHaveBeenCalled();
});
test("client requires verified private response and never retries malformed success", async () => {
  const response = {
    order,
    can_read_details: false,
    items: [],
    next_after: null,
  };
  const transport = vi.fn(async () => ({
    status: 200,
    json: async () => response,
  }));
  await createLinkedWorkClient(transport).list(
    { order_id: id },
    new globalThis.AbortController().signal,
  );
  expect(transport.mock.calls[0][0]).toBe("/api/v1/orders/links");
  expect(transport.mock.calls[0][1]).toMatchObject({
    method: "POST",
    cache: "no-store",
    redirect: "error",
  });
  const bad = vi.fn(async () => ({
    status: 200,
    json: async () => ({ items: [] }),
  }));
  await expect(
    createLinkedWorkClient(bad).list(
      { order_id: id },
      new globalThis.AbortController().signal,
    ),
  ).rejects.toThrow();
  expect(bad).toHaveBeenCalledTimes(1);
});
