import { test, expect, vi } from "vitest";
import { catalogManagementEnabled } from "../../apps/api/dist/app/catalog-management-config.js";
import { assertCatalogManagementReady } from "../../apps/api/dist/modules/catalog/index.js";
import { createCatalogManagementService } from "../../apps/api/dist/modules/catalog/index.js";
import { createCatalogManagementClient } from "../../apps/web/src/features/catalog/management-api.ts";
const id = "82000000-0000-4000-8000-000000000001",
  actor = { accountId: id, sessionId: id };
function fixture(patch = {}) {
  const query = vi.fn(async (sql) => {
    if (patch.fail && sql.startsWith(patch.fail)) throw new Error("INJECTED");
    if (sql.startsWith("SELECT a.profile"))
      return {
        rows: patch.revoked
          ? []
          : [
              {
                profile: patch.profile ?? "admin",
                lifecycle: "active",
                securityLocked: false,
                resetRequired: false,
                sessionValid: true,
                ownerCurrent: true,
                clinicId: id,
                clinicSuspended: false,
                grants: patch.grants ?? ["catalog.manage"],
              },
            ],
      };
    if (sql.startsWith("SELECT a.id FROM public.owner_slot"))
      return { rows: patch.noOwner ? [] : [{ id }] };
    if (sql.startsWith("SELECT o.id,o.clinic_id"))
      return { rows: patch.orders ?? [] };
    if (sql.startsWith("SELECT o.id,o.number"))
      return { rows: patch.impacts ?? [] };
    if (sql.startsWith("SELECT r.id"))
      return {
        rows: [
          {
            id,
            kind: "material",
            label: patch.removed ? null : "Original",
            is_active: patch.removed ? null : true,
            use_state: patch.state ?? "available",
            forbidden_reason:
              patch.state === "forbidden" ? "Synthetic safety reason" : null,
            revision: "1",
          },
        ],
      };
    if (sql.startsWith("UPDATE public.catalog_references"))
      return { rows: [{ id }] };
    if (
      sql.startsWith("UPDATE public.catalog_entries") ||
      sql.startsWith("DELETE FROM public.catalog_entries")
    )
      return { rows: [{ reference_id: id }] };
    return { rows: [] };
  });
  return { query, transaction: vi.fn(async (fn) => fn({ query })) };
}
const edits = {
  operation: "update",
  expected_revision: 1,
  label: "Renamed",
  is_active: false,
  use_state: "unavailable",
};
const writes = (db) =>
  db.query.mock.calls.filter(([sql]) => /^(UPDATE|INSERT|DELETE)/.test(sql));
test("manager creates each independent kind with history audit outbox in a single transaction", async () => {
  for (const kind of ["material", "shade", "work_type"]) {
    const db = fixture();
    const result = await createCatalogManagementService(db).create(actor, {
      kind,
      label: "Synthetic",
    });
    expect(result.kind).toBe("applied");
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(writes(db)).toHaveLength(6);
    expect(writes(db)[0][1][1]).toBe(kind);
  }
});
test("renaming availability and activation only touch current entries and reference metadata", async () => {
  const db = fixture();
  expect(
    await createCatalogManagementService(db).change(actor, id, edits),
  ).toMatchObject({ kind: "applied" });
  const sql = writes(db)
    .map(([s]) => s)
    .join("\n");
  expect(sql).not.toMatch(
    /public\.(orders|order_versions|catalog_reference_snapshots|drafts)/,
  );
  expect(sql).not.toContain("forbidden_reason=");
  const history = writes(db).find(([s]) =>
    s.startsWith("INSERT INTO public.catalog_change_events"),
  )[1];
  expect(JSON.parse(history[5]).label).toBe("Original");
  expect(JSON.parse(history[6])).toMatchObject({
    label: "Renamed",
    use_state: "unavailable",
    is_active: false,
  });
});
test("removal deletes only current entry, preserving reference and snapshots", async () => {
  const db = fixture();
  expect(
    await createCatalogManagementService(db).change(actor, id, {
      operation: "remove",
      expected_revision: 1,
    }),
  ).toMatchObject({ kind: "applied" });
  expect(writes(db).filter(([s]) => s.startsWith("DELETE"))).toEqual([
    [
      "DELETE FROM public.catalog_entries WHERE reference_id=$1 RETURNING reference_id",
      [id],
    ],
  ]);
});
test("forbidden references reject edits and removal even for owner", async () => {
  for (const operation of [
    edits,
    { operation: "remove", expected_revision: 1 },
  ]) {
    const db = fixture({ profile: "owner", state: "forbidden" });
    expect(
      await createCatalogManagementService(db).change(actor, id, operation),
    ).toEqual({ kind: "restricted" });
    expect(writes(db)).toHaveLength(0);
  }
});
test("no granting authority through creator rights or client role; revoked and clinical actors denied", async () => {
  for (const patch of [
    { grants: [] },
    {
      grants: [
        "orders.read_logistics",
        "orders.read_details",
        "orders.create_for_clinic",
      ],
    },
    { profile: "clinic" },
    { revoked: true },
  ]) {
    const db = fixture(patch),
      service = createCatalogManagementService(db);
    expect(await service.list(actor)).toBeNull();
    expect(await service.change(actor, id, edits)).toEqual({ kind: "denied" });
    expect(await service.create(actor, { kind: "shade", label: "x" })).toEqual({
      kind: "denied",
    });
    expect(writes(db)).toHaveLength(0);
  }
});
test("stale revisions, removed entries and malformed mutations fail closed", async () => {
  const db = fixture();
  expect(
    await createCatalogManagementService(db).change(actor, id, {
      ...edits,
      expected_revision: 2,
    }),
  ).toEqual({ kind: "conflict" });
  expect(
    await createCatalogManagementService(fixture({ removed: true })).change(
      actor,
      id,
      edits,
    ),
  ).toEqual({ kind: "conflict" });
  for (const patch of [
    { kind: "shade" },
    { use_state: "forbidden" },
    { forbidden_reason: null },
    { label: " " },
    { label: "x".repeat(501) },
  ])
    expect(
      await createCatalogManagementService(db).change(actor, id, {
        ...edits,
        ...patch,
      }),
    ).toEqual({ kind: "invalid" });
  expect(writes(db)).toHaveLength(0);
});
test("no-op does not mutate revision or emit events; authority rechecked after read", async () => {
  const patch = {},
    db = fixture(patch),
    service = createCatalogManagementService(db);
  expect(await service.profile(actor, id)).not.toBeNull();
  await service.change(actor, id, {
    ...edits,
    label: "Original",
    is_active: true,
    use_state: "available",
  });
  expect(writes(db)).toHaveLength(0);
  patch.revoked = true;
  expect(await service.change(actor, id, edits)).toEqual({ kind: "denied" });
});
test("write failures propagate with no retry, requiring transaction rollback in real SQL receipt", async () => {
  for (const fail of [
    "UPDATE public.catalog_references",
    "UPDATE public.catalog_entries",
    "INSERT INTO public.catalog_change_events",
    "INSERT INTO public.audit_events",
    "INSERT INTO public.outbox_events",
    "INSERT INTO public.outbox_dispatches",
  ]) {
    const db = fixture({ fail });
    await expect(
      createCatalogManagementService(db).change(actor, id, edits),
    ).rejects.toThrow("INJECTED");
    expect(db.transaction).toHaveBeenCalledTimes(1);
  }
});
test("history is paginated and scoped; client never retries ambiguous creation", async () => {
  const db = fixture();
  expect(
    await createCatalogManagementService(db).history(actor, id, 9),
  ).toEqual({ items: [], next_before: null });
  expect(
    db.query.mock.calls.find(([s]) =>
      s.includes("FROM public.catalog_change_events"),
    )[1],
  ).toEqual([id, 9]);
  const controller = new globalThis.AbortController();
  const transport = vi.fn(async () => {
    controller.abort();
    return new globalThis.Response(JSON.stringify({ kind: "applied", id }), {
      status: 201,
    });
  });
  await expect(
    createCatalogManagementClient(transport).create(
      { kind: "shade", label: "x" },
      controller.signal,
    ),
  ).rejects.toThrow("UNCERTAIN");
  expect(transport).toHaveBeenCalledTimes(1);
});

const restriction = {
  operation: "restrict",
  expected_revision: 1,
  reason: "Synthetic safety reason",
};
test("restriction blocks non-delivered historical works without rewriting orders; owner alert shares transaction", async () => {
  const delivered = "82000000-0000-4000-8000-000000000002";
  const db = fixture({
    orders: [
      { id, clinic_id: id, status: "accepted" },
      { id: delivered, clinic_id: id, status: "delivered" },
    ],
  });
  expect(
    await createCatalogManagementService(db).change(actor, id, restriction),
  ).toEqual({ kind: "applied", id });
  expect(db.transaction).toHaveBeenCalledTimes(1);
  const blocks = writes(db).filter(([s]) =>
    s.startsWith("INSERT INTO public.order_security_blocks"),
  );
  expect(blocks).toHaveLength(1);
  expect(blocks[0][1]).toEqual([id, id, id, restriction.reason, id]);
  expect(
    writes(db)
      .map(([s]) => s)
      .join("\n"),
  ).not.toMatch(
    /(?:UPDATE|DELETE FROM) public\.(orders|order_versions|catalog_reference_snapshots|catalog_entries)/,
  );
  const history = writes(db).find(([s]) =>
    s.startsWith("INSERT INTO public.catalog_change_events"),
  )[1];
  expect(history[2]).toBe("restrict");
  expect(JSON.parse(history[6])).toMatchObject({
    use_state: "forbidden",
    forbidden_reason: restriction.reason,
  });
  expect(
    writes(db).filter(([s]) =>
      s.startsWith("INSERT INTO public.outbox_events"),
    ),
  ).toHaveLength(2);
  expect(
    writes(db).find(([s]) =>
      s.startsWith("INSERT INTO public.internal_notifications"),
    )[1][1],
  ).toBe(id);
  expect(
    db.query.mock.calls.find(([s]) =>
      s.startsWith("SELECT o.id,o.clinic_id"),
    )[0],
  ).toContain("FOR UPDATE OF o");
});
test("restriction requires reason, cannot be overwritten and remains possible after current entry removal", async () => {
  for (const reason of [" ", "x".repeat(2001)]) {
    const db = fixture();
    expect(
      await createCatalogManagementService(db).change(actor, id, {
        ...restriction,
        reason,
      }),
    ).toEqual({ kind: "invalid" });
    expect(writes(db)).toHaveLength(0);
  }
  expect(
    await createCatalogManagementService(fixture({ removed: true })).change(
      actor,
      id,
      restriction,
    ),
  ).toEqual({ kind: "applied", id });
  const db = fixture({ state: "forbidden", profile: "owner" });
  expect(
    await createCatalogManagementService(db).change(actor, id, restriction),
  ).toEqual({ kind: "restricted" });
  expect(writes(db)).toHaveLength(0);
});
test("security block or owner notification failures abort without retry or downgraded success", async () => {
  for (const fail of [
    "INSERT INTO public.order_security_blocks",
    "INSERT INTO public.internal_notifications",
    "INSERT INTO public.notification_deliveries",
  ]) {
    const db = fixture({
      fail,
      orders: [{ id, clinic_id: id, status: "manufacturing" }],
    });
    await expect(
      createCatalogManagementService(db).change(actor, id, restriction),
    ).rejects.toThrow("INJECTED");
    expect(db.transaction).toHaveBeenCalledTimes(1);
  }
  await expect(
    createCatalogManagementService(fixture({ noOwner: true })).change(
      actor,
      id,
      restriction,
    ),
  ).rejects.toThrow("CATALOG_OWNER_ALERT_UNAVAILABLE");
});
test("only current owner may inspect impacted works, including delivered works, with bounded cursor", async () => {
  const denied = fixture();
  expect(
    await createCatalogManagementService(denied).impacts(actor, id),
  ).toBeNull();
  expect(
    denied.query.mock.calls.some(([s]) => s.startsWith("SELECT o.id")),
  ).toBe(false);
  const row = { id, number: "123", clinic_id: id, status: "delivered" };
  const db = fixture({ profile: "owner", impacts: [row] });
  expect(
    await createCatalogManagementService(db).impacts(actor, id, id),
  ).toEqual({ items: [row], next_after: null });
  expect(
    db.query.mock.calls.find(([s]) => s.startsWith("SELECT o.id,o.number"))[1],
  ).toEqual([id, id]);
});

test("catalogue runtime defaults closed and refuses missing append-only storage privileges", async () => {
  expect(catalogManagementEnabled({})).toBe(false);
  expect(
    catalogManagementEnabled({
      DENTAL_LAB_CATALOG_MANAGEMENT_ENABLED: "true",
      DENTAL_LAB_AUTH_ENABLED: "true",
    }),
  ).toBe(true);
  for (const env of [
    { DENTAL_LAB_CATALOG_MANAGEMENT_ENABLED: "yes" },
    { DENTAL_LAB_CATALOG_MANAGEMENT_ENABLED: "true" },
  ])
    expect(() => catalogManagementEnabled(env)).toThrow();
  for (const rows of [[], [{ ready: false }]]) {
    await expect(
      assertCatalogManagementReady({ query: async () => ({ rows }) }),
    ).rejects.toThrow("CATALOG_MANAGEMENT_NOT_READY");
  }
  const query = vi.fn(async () => ({ rows: [{ ready: true }] }));
  await assertCatalogManagementReady({ query });
  expect(query.mock.calls[0][0]).toContain("NOT has_table_privilege");
});
test("restriction stops before writing if impact exceeds bounded transaction capacity", async () => {
  const db = fixture({
    orders: Array.from({ length: 1001 }, () => ({
      id,
      clinic_id: id,
      status: "accepted",
    })),
  });
  await expect(
    createCatalogManagementService(db).change(actor, id, restriction),
  ).rejects.toThrow("CATALOG_IMPACT_CAPACITY_EXCEEDED");
  expect(writes(db)).toHaveLength(0);
});
