import { test, expect, vi } from "vitest";
import { createActionInboxService } from "../../apps/api/dist/modules/orders/index.js";
import { actionInboxEnabled } from "../../apps/api/dist/app/action-inbox-config.js";
import { createActionInboxClient } from "../../apps/web/src/features/orders/action-inbox-api.ts";
const id = "95000000-0000-4000-8000-000000000001",
  actor = { accountId: id, sessionId: id };
const all = [
  "orders.read_logistics",
  "orders.read_details",
  "orders.accept",
  "orders.edit_instructions",
  "orders.cancel",
  "clinics.manage",
];
function fixture(patch = {}) {
  const calls = [];
  const query = vi.fn(async (sql, values = []) => {
    calls.push([sql, values]);
    if (sql.startsWith("SELECT a.profile"))
      return {
        rows: patch.denied
          ? []
          : [
              {
                profile: patch.profile ?? "employee",
                lifecycle: patch.suspended ? "suspended" : "active",
                sessionValid: true,
                securityLocked: false,
                resetRequired: false,
                clinicId: id,
                clinicSuspended: false,
                grants: patch.grants ?? all,
              },
            ],
      };
    if (sql.startsWith("WITH actions")) return { rows: patch.rows ?? [] };
    if (
      sql.startsWith("LOCK TABLE") ||
      /^SELECT id FROM public.(accounts|sessions)/.test(sql)
    )
      return { rows: [{ id }] };
    throw new Error("UNEXPECTED_SQL " + sql);
  });
  return { calls, query, transaction: vi.fn(async (fn) => fn({ query })) };
}
const row = {
  id,
  kind: "retouch",
  rank: 0,
  order_id: id,
  number: "9007199254740993",
  clinic_name: "Synthetic clinic",
  occurred_at: new Date("2026-10-19T12:00:00Z"),
  revision: "2",
};

test("action categories use current effective rights; missing prerequisites do not expose medical workflows", async () => {
  const cases = [
    [
      ["orders.read_logistics", "orders.read_details", "orders.accept"],
      [true, false, false, false],
    ],
    [
      [
        "orders.read_logistics",
        "orders.read_details",
        "orders.request_correction",
      ],
      [true, false, false, false],
    ],
    [
      [
        "orders.read_logistics",
        "orders.read_details",
        "orders.edit_instructions",
      ],
      [false, true, false, false],
    ],
    [
      ["orders.read_logistics", "orders.cancel"],
      [false, false, true, false],
    ],
    [["clinics.manage"], [false, false, false, true]],
  ];
  for (const [grants, flags] of cases) {
    const db = fixture({ grants });
    const r = await createActionInboxService(db).list(actor, {});
    expect(r.kind).toBe("page");
    expect(
      db.calls.find(([s]) => s.startsWith("WITH actions"))[1].slice(0, 4),
    ).toEqual(flags);
  }
  for (const patch of [
    { profile: "clinic" },
    { denied: true },
    { suspended: true },
    { grants: [] },
    { grants: ["orders.accept"] },
    { grants: ["orders.read_logistics"] },
  ]) {
    const db = fixture(patch);
    expect((await createActionInboxService(db).list(actor, {})).kind).toBe(
      "denied",
    );
    expect(db.calls.some(([s]) => s.startsWith("WITH actions"))).toBe(false);
  }
});

test("queue derives outstanding workflow state with retouch priority and ignores notification read flags", async () => {
  const db = fixture({ rows: [row] }),
    service = createActionInboxService(db);
  const a = await service.list(actor, {}),
    b = await service.list(actor, {});
  expect(a).toEqual(b);
  expect(a.page.items[0]).toMatchObject({
    kind: "retouch",
    rank: 0,
    revision: 2,
    number: row.number,
    occurred_at: "2026-10-19T12:00:00.000Z",
  });
  const sql = db.calls.find(([s]) => s.startsWith("WITH actions"))[0];
  expect(sql).toContain("o.status='pending'");
  expect(sql).toContain("r.state='pending' AND o.status='accepted'");
  expect(sql).toContain("c.review_state='pending'");
  expect(sql).toContain("latest.previous_status='correction_requested'");
  expect(sql).toContain("WHEN o.kind='retouch' THEN 0");
  expect(sql).toContain("ORDER BY e.aggregate_revision DESC LIMIT 1");
  expect(sql).not.toMatch(/notification|patient|order_versions|read_at/i);
  expect(db.calls.map(([s]) => s).join("\n")).not.toMatch(
    /\b(INSERT|UPDATE|DELETE)\b/,
  );
});

test("bounded composite cursor is stable across priorities and independent entity kinds without timestamp precision loss", async () => {
  const rows = Array.from({ length: 51 }, (_, i) => ({
      ...row,
      id: "95000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
    })),
    db = fixture({ rows }),
    svc = createActionInboxService(db);
  const page = (await svc.list(actor, {})).page;
  expect(page.items).toHaveLength(50);
  expect(page.next_after).toEqual({
    rank: 0,
    id: rows[49].id,
    kind: "retouch",
  });
  await svc.list(actor, { after: page.next_after });
  expect(
    db.calls
      .filter(([s]) => s.startsWith("WITH actions"))
      .at(-1)[1]
      .slice(4),
  ).toEqual([0, rows[49].id, "retouch"]);
  expect(db.calls.find(([s]) => s.startsWith("WITH actions"))[0]).toContain(
    "(rank,id,kind)>($5::integer,$6::uuid,$7::text)",
  );
  const short = fixture({
    rows: [
      { ...row, kind: "registration", rank: 2, order_id: null, number: null },
    ],
  });
  expect(
    (await createActionInboxService(short).list(actor, {})).page.next_after,
  ).toBe(null);
});

test("strict cursor refuses injection before transaction and strict DTO rejects accidental medical fields", async () => {
  for (const raw of [
    { permissions: all },
    { after: { rank: -1, id, kind: "retouch" } },
    { after: { rank: 0, id: "injection", kind: "retouch" } },
    { after: { rank: 0, id, kind: "unknown" } },
  ]) {
    const db = fixture();
    expect((await createActionInboxService(db).list(actor, raw)).kind).toBe(
      "invalid",
    );
    expect(db.transaction).not.toHaveBeenCalled();
  }
  const db = fixture({
    rows: [{ ...row, patient_reference: "Must not escape" }],
  });
  await expect(createActionInboxService(db).list(actor, {})).rejects.toThrow();
});

test("inbox stays disabled without dependencies; transport enforces private validated response without retries", async () => {
  expect(actionInboxEnabled({})).toBe(false);
  expect(() =>
    actionInboxEnabled({ DENTAL_LAB_ACTION_INBOX_ENABLED: "true" }),
  ).toThrow();
  expect(
    actionInboxEnabled({
      DENTAL_LAB_ACTION_INBOX_ENABLED: "true",
      DENTAL_LAB_ORDER_MODIFICATION_ENABLED: "true",
      DENTAL_LAB_CLINIC_MANAGEMENT_ENABLED: "true",
    }),
  ).toBe(true);
  const transport = vi.fn(async () => ({
      status: 200,
      json: async () => ({ permissions: [], items: [], next_after: null }),
    })),
    signal = new globalThis.AbortController().signal;
  expect(await createActionInboxClient(transport).list({}, signal)).toEqual({
    permissions: [],
    items: [],
    next_after: null,
  });
  expect(transport.mock.calls[0]).toEqual([
    "/api/v1/orders/actions",
    expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal,
      body: "{}",
    }),
  ]);
  const fail = vi.fn(async () => ({ status: 403 }));
  await expect(
    createActionInboxClient(fail).list({}, signal),
  ).rejects.toThrow();
  expect(fail).toHaveBeenCalledTimes(1);
});
