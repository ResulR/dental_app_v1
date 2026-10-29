import { test, expect, vi } from "vitest";
import { createOrderTrackingService } from "../../apps/api/dist/modules/orders/index.js";
import { createOrderTrackingClient } from "../../apps/web/src/features/orders/tracking-api.ts";
const id = "91000000-0000-4000-8000-000000000001",
  other = "91000000-0000-4000-8000-000000000002",
  actor = { accountId: id, sessionId: id };
const summary = {
  id,
  number: "1",
  clinic_name: "Synthetic",
  kind: "normal",
  origin: "clinic",
  status: "manufacturing",
  received_at: new Date("2026-10-16T12:00:00Z"),
  requested_delivery_date: "2026-11-01",
  planned_delivery_date: null,
  priority: false,
};
function fixture(patch = {}) {
  const query = vi.fn(async (sql) => {
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
                ownerCurrent: true,
                clinicId: id,
                clinicSuspended: patch.suspended ?? false,
                grants: patch.grants ?? [],
              },
            ],
      };
    if (sql.startsWith("SELECT id FROM public.clinics WHERE account_id=$1 AND"))
      return { rows: patch.unapproved ? [] : [{ id }] };
    if (sql.startsWith("SELECT id,clinic_id,current_version_id"))
      return {
        rows: patch.foreign
          ? []
          : [
              {
                id,
                clinic_id: id,
                current_version_id: patch.stale ? other : id,
              },
            ],
      };
    if (sql.includes("FROM public.order_version_files b"))
      return {
        rows: patch.files ?? [
          {
            id,
            filename: "Synthetic.stl",
            format: "stl",
            size_bytes: "3",
            object_key: "SECRET_NOT_EXPOSED",
          },
        ],
      };
    if (sql.startsWith("SELECT id FROM public.orders WHERE"))
      return { rows: patch.foreign ? [] : [{ id }] };
    if (sql.startsWith("SELECT o.id,o.number")) {
      if (sql.includes("m.label AS material"))
        return {
          rows: [
            {
              ...summary,
              revision: "3",
              version_id: id,
              patient: { internal_reference: "Synthetic" },
              description: null,
              material: "Old material",
              shade: "Old shade",
              work_type: null,
              teeth: [],
              file_count: 0,
              security_block: false,
            },
          ],
        };
      return { rows: patch.rows ?? [summary] };
    }
    if (sql.startsWith("SELECT previous_status"))
      return {
        rows: patch.history ?? [
          {
            previous_status: "accepted",
            next_status: "manufacturing",
            occurred_at: summary.received_at,
            reason: null,
            actor_id: id,
            aggregate_revision: "3",
            decided_version_id: id,
          },
        ],
      };
    return { rows: [] };
  });
  return { query, transaction: vi.fn((fn) => fn({ query })) };
}
test("clinic search and detail always constrain current clinic, foreign order denied before reading patient", async () => {
  const db = fixture(),
    service = createOrderTrackingService(db);
  expect((await service.search(actor, {})).page.can_read_details).toBe(true);
  expect(
    db.query.mock.calls.find(([s]) =>
      s.startsWith("SELECT o.id,o.number"),
    )[1][0],
  ).toBe(id);
  const detail = await service.detail(actor, { order_id: id });
  expect(detail.detail.order.material).toBe("Old material");
  expect(detail.detail.history[0].next_status).toBe("manufacturing");
  expect(
    db.query.mock.calls.find(([s]) =>
      s.startsWith("SELECT id FROM public.orders"),
    )[1],
  ).toEqual([id, id]);
  const foreign = fixture({ foreign: true });
  expect(
    (
      await createOrderTrackingService(foreign).detail(actor, {
        order_id: other,
      })
    ).kind,
  ).toBe("denied");
  expect(
    foreign.query.mock.calls.some(([s]) => s.includes("m.label AS material")),
  ).toBe(false);
});
test("logistics-only reader never queries patient search or details; current revocation and suspension deny", async () => {
  const db = fixture({
      profile: "employee",
      grants: ["orders.read_logistics"],
    }),
    service = createOrderTrackingService(db);
  expect(
    (await service.search(actor, { q: "Synthetic" })).page.can_read_details,
  ).toBe(false);
  const sql = db.query.mock.calls.find(([s]) =>
    s.startsWith("SELECT o.id,o.number"),
  )[0];
  expect(sql).not.toContain("patient_");
  expect(
    (await service.search(actor, { work_type: "Synthetic crown" })).kind,
  ).toBe("denied");
  expect(
    db.query.mock.calls.filter(([s]) => s.startsWith("SELECT o.id,o.number")),
  ).toHaveLength(1);
  expect((await service.detail(actor, { order_id: id })).kind).toBe("denied");
  for (const patch of [
    { revoked: true },
    { suspended: true },
    { unapproved: true },
    { profile: "employee" },
  ]) {
    const refused = fixture(patch);
    expect(
      (await createOrderTrackingService(refused).search(actor, {})).kind,
    ).toBe("denied");
    expect(
      refused.query.mock.calls.some(([s]) =>
        s.startsWith("SELECT o.id,o.number"),
      ),
    ).toBe(false);
  }
});
test("search parameters are bound, dates validated, history pagination explicit and no writes occur", async () => {
  const db = fixture({
    history: Array.from({ length: 101 }, (_, i) => ({
      previous_status: null,
      next_status: "pending",
      occurred_at: summary.received_at,
      reason: null,
      actor_id: id,
      aggregate_revision: String(101 - i),
      decided_version_id: id,
    })),
  });
  const service = createOrderTrackingService(db);
  await service.search(actor, {
    q: "%'_",
    status: "completed",
    kind: "retouch",
    work_type: "Synthetic crown",
    date_kind: "planned",
    from: "2026-11-01",
    to: "2026-11-30",
    after: id,
  });
  expect(
    db.query.mock.calls.find(([s]) => s.startsWith("SELECT o.id,o.number"))[1],
  ).toEqual([
    id,
    id,
    "%'_",
    "completed",
    "retouch",
    "planned",
    "2026-11-01",
    "2026-11-30",
    "active",
    "Synthetic crown",
  ]);
  const searchSql = db.query.mock.calls.find(([s]) =>
    s.startsWith("SELECT o.id,o.number"),
  )[0];
  expect(searchSql).toContain("w.id=v.work_type_snapshot_id");
  expect(searchSql).toContain("strpos(lower(w.label),lower($10))>0");
  const result = await service.detail(actor, { order_id: id });
  expect(result.detail.history).toHaveLength(100);
  expect(result.detail.next_before_revision).toBe(2);
  expect(
    db.query.mock.calls.some(([s]) => /^(INSERT|UPDATE|DELETE)/.test(s)),
  ).toBe(false);
  const invalid = fixture();
  for (const raw of [
    { clinic_id: id },
    { from: "2026-11-02", to: "2026-11-01" },
    { from: "2026-02-30" },
    { work_type: " " },
  ])
    expect(
      (await createOrderTrackingService(invalid).search(actor, raw)).kind,
    ).toBe("invalid");
  expect(invalid.transaction).not.toHaveBeenCalled();
});
test("patient query stays in POST body with no-store and client refuses incompatible response without retry", async () => {
  const fetcher = vi.fn(
    async () =>
      new globalThis.Response(
        JSON.stringify({ can_read_details: true, items: [], next_after: null }),
        { status: 200 },
      ),
  );
  await createOrderTrackingClient(fetcher).search(
    { q: "Synthetic patient" },
    new globalThis.AbortController().signal,
  );
  expect(fetcher.mock.calls[0][0]).toBe("/api/v1/orders/search");
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    method: "POST",
    cache: "no-store",
    redirect: "error",
  });
  expect(fetcher.mock.calls[0][1].body).toContain("Synthetic patient");
  const bad = vi.fn(async () => new globalThis.Response("{}", { status: 200 }));
  await expect(
    createOrderTrackingClient(bad).detail(
      { order_id: id },
      new globalThis.AbortController().signal,
    ),
  ).rejects.toThrow();
  expect(bad).toHaveBeenCalledTimes(1);
});

test("list cursor is bounded and history cursor stays scoped to the requested order", async () => {
  const rows = Array.from({ length: 51 }, (_, i) => ({
    ...summary,
    id: `91000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  }));
  const db = fixture({ rows }),
    service = createOrderTrackingService(db);
  const result = await service.search(actor, {});
  expect(result.page.items).toHaveLength(50);
  expect(result.page.next_after).toBe(rows[49].id);
  await service.detail(actor, { order_id: id, before_revision: 3 });
  expect(
    db.query.mock.calls.find(([sql]) =>
      sql.startsWith("SELECT previous_status"),
    )[1],
  ).toEqual([id, 3]);
});
test("database errors never produce an empty success and tracking activation fails closed", async () => {
  const { orderTrackingEnabled } =
    await import("../../apps/api/dist/app/order-tracking-config.js");
  expect(orderTrackingEnabled({})).toBe(false);
  expect(
    orderTrackingEnabled({ DENTAL_LAB_ORDER_TRACKING_ENABLED: "false" }),
  ).toBe(false);
  for (const env of [
    { DENTAL_LAB_ORDER_TRACKING_ENABLED: "true" },
    {
      DENTAL_LAB_ORDER_TRACKING_ENABLED: "yes",
      DENTAL_LAB_ORDER_SUBMISSION_ENABLED: "true",
    },
  ])
    expect(() => orderTrackingEnabled(env)).toThrow(
      "INVALID_ORDER_TRACKING_CONFIG",
    );
  expect(
    orderTrackingEnabled({
      DENTAL_LAB_ORDER_TRACKING_ENABLED: "true",
      DENTAL_LAB_ORDER_SUBMISSION_ENABLED: "true",
    }),
  ).toBe(true);
  const service = createOrderTrackingService({
    transaction: async () => {
      throw new Error("Synthetic database failure");
    },
  });
  await expect(service.search(actor, {})).rejects.toThrow(
    "Synthetic database failure",
  );
  await expect(service.detail(actor, { order_id: id })).rejects.toThrow(
    "Synthetic database failure",
  );
});

test("file metadata scopes parent and current version, filters unhealthy objects and exposes no storage identifier", async () => {
  const db = fixture();
  const result = await createOrderTrackingService(db).files(actor, {
    order_id: id,
    version_id: id,
  });
  expect(result).toMatchObject({
    kind: "page",
    page: {
      version_id: id,
      download_available: false,
      items: [{ id, filename: "Synthetic.stl", format: "stl", size_bytes: 3 }],
    },
  });
  expect(JSON.stringify(result)).not.toContain("SECRET");
  const parent = db.query.mock.calls.find(([s]) =>
    s.startsWith("SELECT id,clinic_id,current_version_id"),
  );
  expect(parent[1]).toEqual([id, id]);
  expect(parent[0]).toContain("FOR SHARE");
  const files = db.query.mock.calls.find(([s]) =>
    s.includes("FROM public.order_version_files b"),
  );
  expect(files[1]).toEqual([id, id, id, null]);
  expect(files[0]).toContain("f.state='ready'");
  expect(files[0]).toContain("LIMIT 51");
});
test("file metadata denies foreign clinic stale version revoked/suspended account and missing detailed/file grants before any filename read", async () => {
  for (const patch of [
    { foreign: true },
    { stale: true },
    { revoked: true },
    { suspended: true },
    { unapproved: true },
    { profile: "employee", grants: ["orders.read_logistics", "files.view"] },
    {
      profile: "employee",
      grants: ["orders.read_logistics", "orders.read_details"],
    },
    {
      profile: "employee",
      grants: [
        "orders.read_logistics",
        "orders.read_details",
        "files.download",
      ],
    },
  ]) {
    const db = fixture(patch);
    expect(
      (
        await createOrderTrackingService(db).files(actor, {
          order_id: id,
          version_id: id,
        })
      ).kind,
    ).toBe("denied");
    expect(
      db.query.mock.calls.some(([s]) =>
        s.includes("FROM public.order_version_files b"),
      ),
    ).toBe(false);
  }
  const db = fixture({
    profile: "employee",
    grants: ["orders.read_logistics", "orders.read_details", "files.view"],
  });
  expect(
    (
      await createOrderTrackingService(db).files(actor, {
        order_id: id,
        version_id: id,
      })
    ).kind,
  ).toBe("page");
  const invalid = fixture();
  expect(
    (
      await createOrderTrackingService(invalid).files(actor, {
        order_id: id,
        version_id: id,
        clinic_id: other,
      })
    ).kind,
  ).toBe("invalid");
  expect(invalid.transaction).not.toHaveBeenCalled();
});
test("metadata pagination does not expose extra row and client rejects false download readiness or mismatched version", async () => {
  const files = Array.from({ length: 51 }, (_, i) => ({
    id: "91000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
    filename: "Synthetic.stl",
    format: "stl",
    size_bytes: "3",
  }));
  const page = (
    await createOrderTrackingService(fixture({ files })).files(actor, {
      order_id: id,
      version_id: id,
      after: other,
    })
  ).page;
  expect(page.items).toHaveLength(50);
  expect(page.next_after).toBe(files[49].id);
  for (const change of [{ version_id: other }, { download_available: true }]) {
    const transport = vi.fn(
      async () =>
        new globalThis.Response(JSON.stringify({ ...page, ...change }), {
          status: 200,
        }),
    );
    await expect(
      createOrderTrackingClient(transport).files(
        { order_id: id, version_id: id },
        new globalThis.AbortController().signal,
      ),
    ).rejects.toThrow();
    expect(transport).toHaveBeenCalledTimes(1);
  }
});

test("archive is a scoped J+30 interface view and keeps details available", async () => {
  const db = fixture();
  const service = createOrderTrackingService(db);
  const active = await service.search(actor, {});
  const archived = await service.search(actor, {
    view: "archive",
    q: "Synthetic",
  });
  expect(active.kind).toBe("page");
  expect(archived.kind).toBe("page");
  const searchCalls = db.query.mock.calls.filter(
    ([s]) =>
      s.startsWith("SELECT o.id,o.number") &&
      !s.includes("m.label AS material"),
  );
  expect(searchCalls[0][1][8]).toBe("active");
  expect(searchCalls[1][1][8]).toBe("archive");
  expect(searchCalls[1][0]).toContain(
    "l.archive_due_at<=statement_timestamp()",
  );
  expect(searchCalls[1][0]).toContain("o.clinic_id=$1");
  expect((await service.detail(actor, { order_id: id })).kind).toBe("detail");
  expect(
    db.query.mock.calls.some(([s]) => /^(UPDATE|DELETE|INSERT)/.test(s)),
  ).toBe(false);
  expect((await service.search(actor, { view: "all" })).kind).toBe("invalid");
});
