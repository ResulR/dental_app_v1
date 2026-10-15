import { test, expect, vi } from "vitest";
import { createCatalogService } from "../../apps/api/dist/modules/catalog/index.js";
import { catalogEnabled } from "../../apps/api/dist/app/catalog-config.js";
import { createCatalogClient } from "../../apps/web/src/features/catalog/catalog-api.ts";
const id = "81000000-0000-4000-8000-000000000001",
  actor = { accountId: id, sessionId: id };
function fixture(patch = {}, rows = []) {
  const query = vi.fn(async (sql) => {
    if (sql.startsWith("SELECT a.profile"))
      return {
        rows: patch.revoked
          ? []
          : [
              {
                profile: "clinic",
                lifecycle: "active",
                sessionValid: true,
                securityLocked: false,
                resetRequired: false,
                clinicId: id,
                clinicSuspended: false,
                grants: [],
                ...patch,
              },
            ],
      };
    if (sql.startsWith("SELECT r.id")) return { rows };
    return { rows: [] };
  });
  return { query, transaction: vi.fn(async (fn) => fn({ query })) };
}
test("catalog runtime remains opt-in behind authentication", () => {
  expect(catalogEnabled({})).toBe(false);
  expect(() =>
    catalogEnabled({ DENTAL_LAB_CATALOG_ENABLED: "true" }),
  ).toThrow();
});
test("active clinic and current owner read; lab needs effective catalogue or creation rights", async () => {
  for (const patch of [
    {},
    { profile: "owner", ownerCurrent: true },
    { profile: "admin", grants: ["catalog.manage"] },
    {
      profile: "employee",
      grants: [
        "orders.read_logistics",
        "orders.read_details",
        "orders.create_for_clinic",
      ],
    },
  ]) {
    const db = fixture(patch, [
      { id, kind: "shade", label: "A1", revision: "2" },
    ]);
    expect(await createCatalogService(db).list(actor, "shade")).toEqual({
      items: [{ id, kind: "shade", label: "A1", revision: 2 }],
      next_after: null,
    });
  }
});
test("revoked, suspended, reset, locked, stale owner and missing dependencies deny before catalogue query", async () => {
  for (const patch of [
    { revoked: true },
    { lifecycle: "suspended" },
    { securityLocked: true },
    { resetRequired: true },
    { clinicSuspended: true },
    { profile: "owner", ownerCurrent: false },
    { profile: "admin", grants: [] },
    { profile: "employee", grants: ["orders.create_for_clinic"] },
  ]) {
    const db = fixture(patch);
    expect(await createCatalogService(db).list(actor, "material")).toBeNull();
    expect(db.query.mock.calls.some(([s]) => s.startsWith("SELECT r.id"))).toBe(
      false,
    );
  }
});
test("query proposes only active available entries, never snapshots or missing labels", async () => {
  const db = fixture();
  await createCatalogService(db).list(actor, "work_type", id);
  const [sql, values] = db.query.mock.calls.find(([s]) =>
    s.startsWith("SELECT r.id"),
  );
  expect(values).toEqual(["work_type", id]);
  expect(sql).toContain("JOIN public.catalog_entries");
  expect(sql).toContain("r.use_state='available'");
  expect(sql).toContain("e.is_active");
  expect(sql).toContain("LIMIT 51");
  expect(sql).not.toContain("catalog_reference_snapshots");
  expect(
    db.query.mock.calls.some(([s]) => /^(INSERT|UPDATE|DELETE)/.test(s)),
  ).toBe(false);
});
test("pages bounded to50 and invalid cursors/kinds never query", async () => {
  const rows = Array.from({ length: 51 }, (_, i) => ({
    id: `81000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    kind: "material",
    label: "Synthetic",
    revision: "1",
  }));
  const db = fixture({}, rows),
    service = createCatalogService(db);
  const result = await service.list(actor, "material");
  expect(result.items).toHaveLength(50);
  expect(result.next_after).toBe(rows[49].id);
  const empty = fixture();
  for (const [kind, after] of [
    ["unknown", undefined],
    ["shade", "bad"],
  ])
    await expect(
      createCatalogService(empty).list(actor, kind, after),
    ).rejects.toThrow();
  expect(empty.query).not.toHaveBeenCalled();
});
test("authorization is renewed for next page and errors propagate without stale fallback", async () => {
  const patch = {},
    db = fixture(patch),
    service = createCatalogService(db);
  expect(await service.list(actor, "material")).not.toBeNull();
  patch.revoked = true;
  expect(await service.list(actor, "material", id)).toBeNull();
  await expect(
    createCatalogService({
      transaction: async () => {
        throw new Error("DATABASE_DOWN");
      },
    }).list(actor, "shade"),
  ).rejects.toThrow("DATABASE_DOWN");
});
test("web transport rejects wrong-kind and late results; never stores or retries", async () => {
  const controller = new globalThis.AbortController(),
    transport = vi.fn(async () => {
      controller.abort();
      return new globalThis.Response(
        JSON.stringify({ items: [], next_after: null }),
        { status: 200 },
      );
    });
  await expect(
    createCatalogClient(transport).list("shade", controller.signal),
  ).rejects.toThrow();
  expect(transport).toHaveBeenCalledTimes(1);
  expect(transport.mock.calls[0][1]).toMatchObject({
    cache: "no-store",
    redirect: "error",
  });
  const wrong = async () =>
    new globalThis.Response(
      JSON.stringify({
        items: [{ id, kind: "material", label: "x", revision: 1 }],
        next_after: null,
      }),
      { status: 200 },
    );
  await expect(
    createCatalogClient(wrong).list(
      "shade",
      new globalThis.AbortController().signal,
    ),
  ).rejects.toThrow();
});
