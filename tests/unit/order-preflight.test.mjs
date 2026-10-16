import { test, expect, vi } from "vitest";
import { createOrderPreflightService } from "../../apps/api/dist/modules/orders/index.js";
import { orderPreflightEnabled } from "../../apps/api/dist/app/order-preflight-config.js";
import { OrderPreflightInputSchema } from "../../packages/contracts/dist/index.js";
import { createOrderPreflightClient } from "../../apps/web/src/features/orders/preflight-api.ts";
const id = "91000000-0000-4000-8000-000000000001",
  shade = "91000000-0000-4000-8000-000000000002";
const actor = { accountId: id, sessionId: id },
  input = {
    patient: { internal_reference: "Synthetic" },
    requested_delivery_date: "2026-11-01",
    material_id: id,
    shade_id: shade,
    teeth: [],
    file_ids: [],
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
                clinicId: id,
                clinicSuspended: patch.suspended ?? false,
                grants: [],
              },
            ],
      };
    if (sql.startsWith("SELECT id FROM public.clinics WHERE account_id=$1 AND"))
      return { rows: patch.unapproved ? [] : [{ id }] };
    if (sql.startsWith("SELECT id,kind,label"))
      return {
        rows: patch.missing
          ? []
          : [
              {
                id,
                kind: patch.wrongKind ? "shade" : "material",
                label: patch.removed ? null : "Synthetic material",
                revision: "2",
                state: patch.state ?? "available",
              },
              {
                id: shade,
                kind: "shade",
                label: "Synthetic shade",
                revision: "1",
                state: "available",
              },
            ],
      };
    return { rows: [] };
  });
  return { query, transaction: vi.fn(async (fn) => fn({ query })) };
}
test("preflight reads fresh catalogue under sorted shared locks and never creates orders or snapshots", async () => {
  const db = fixture(),
    result = await createOrderPreflightService(db).check(actor, input);
  expect(result).toMatchObject({
    kind: "checked",
    result: {
      persisted: false,
      status: "checked",
      reasons: [],
      warnings: ["low_detail"],
    },
  });
  expect(db.transaction).toHaveBeenCalledTimes(1);
  expect(
    db.query.mock.calls.find(([s]) => s.includes("ORDER BY id FOR SHARE"))[1],
  ).toEqual([[id, shade]]);
  expect(
    db.query.mock.calls.some(([s]) => /^(INSERT|UPDATE|DELETE)/.test(s)),
  ).toBe(false);
});
test("forbidden blocks, unavailable only warns, missing or wrong kind blocks", async () => {
  for (const [patch, status, code] of [
    [{ state: "forbidden" }, "blocked", "catalog_forbidden"],
    [{ state: "unavailable", removed: true }, "checked", "catalog_unavailable"],
    [{ missing: true }, "blocked", "catalog_missing"],
    [{ wrongKind: true }, "blocked", "catalog_missing"],
  ]) {
    const result = (
      await createOrderPreflightService(fixture(patch)).check(actor, input)
    ).result;
    expect(result.status).toBe(status);
    expect([...result.reasons, ...result.warnings]).toContain(code);
  }
  const result = (
    await createOrderPreflightService(fixture()).check(actor, {
      ...input,
      shade_id: id,
    })
  ).result;
  expect(result.reasons).toContain("catalog_missing");
});
test("only currently approved unsuspended clinic may check; lab actors cannot impersonate clinic", async () => {
  for (const patch of [
    { profile: "admin" },
    { profile: "employee" },
    { profile: "owner" },
    { revoked: true },
    { suspended: true },
    { unapproved: true },
  ]) {
    const db = fixture(patch);
    expect(await createOrderPreflightService(db).check(actor, input)).toEqual({
      kind: "denied",
    });
    expect(
      db.query.mock.calls.some(([s]) => s.includes("catalog_effective_states")),
    ).toBe(false);
  }
});
test("patient alternatives dates UUIDs FDI duplicates and injected ownership are validated without database access", async () => {
  for (const patient of [
    { first_name: "Synthetic", last_name: "Person" },
    { internal_reference: "REF" },
    { first_name: "Synthetic", last_name: "Person", internal_reference: "REF" },
  ])
    expect(
      OrderPreflightInputSchema.safeParse({ ...input, patient }).success,
    ).toBe(true);
  for (const patch of [
    { patient: {} },
    { patient: { first_name: "Only", internal_reference: "REF" } },
    { requested_delivery_date: "2026-02-30" },
    { material_id: "bad" },
    { clinic_id: id },
    { planned_delivery_date: "2026-11-02" },
    { teeth: [{ fdi: 19, selection: "normal" }] },
    {
      teeth: [
        { fdi: 11, selection: "normal" },
        { fdi: 11, selection: "pontic" },
      ],
    },
  ]) {
    const db = fixture();
    expect(
      await createOrderPreflightService(db).check(actor, {
        ...input,
        ...patch,
      }),
    ).toEqual({ kind: "invalid" });
    expect(db.transaction).not.toHaveBeenCalled();
  }
});
test("optional details do not become mandatory; unsupported files fail closed instead of disappearing", async () => {
  expect(
    (
      await createOrderPreflightService(fixture()).check(actor, {
        ...input,
        description: "Synthetic detail",
      })
    ).result.warnings,
  ).toEqual([]);
  expect(
    (
      await createOrderPreflightService(fixture()).check(actor, {
        ...input,
        teeth: [{ fdi: 11, selection: "pontic" }],
      })
    ).result.warnings,
  ).toEqual([]);
  expect(
    (
      await createOrderPreflightService(fixture()).check(actor, {
        ...input,
        file_ids: [id],
      })
    ).result,
  ).toMatchObject({ status: "blocked", reasons: ["files_not_ready"] });
});
test("client rejects fake persistence claim and aborted response without retry; feature defaults off", async () => {
  const signal = new globalThis.AbortController().signal;
  const transport = vi.fn(
    async () =>
      new globalThis.Response(
        JSON.stringify({
          persisted: true,
          status: "checked",
          reasons: [],
          warnings: [],
          references: [],
        }),
      ),
  );
  await expect(
    createOrderPreflightClient(transport).check(input, signal),
  ).rejects.toThrow();
  expect(transport).toHaveBeenCalledTimes(1);
  expect(transport.mock.calls[0][1]).toMatchObject({
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
  });
  expect(orderPreflightEnabled({})).toBe(false);
  expect(() =>
    orderPreflightEnabled({
      DENTAL_LAB_ORDER_PREFLIGHT_ENABLED: "true",
      DENTAL_LAB_AUTH_ENABLED: "true",
    }),
  ).toThrow();
});
