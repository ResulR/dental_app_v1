import { test, expect, vi } from "vitest";
import { createOrderSimilarityService } from "../../apps/api/dist/modules/orders/index.js";
import {
  OrderSimilarityInputSchema,
  OrderSimilarityResultSchema,
} from "../../packages/contracts/dist/index.js";
import { createOrderSimilarityClient } from "../../apps/web/src/features/orders/similarity-api.ts";

const id = "91000000-0000-4000-8000-000000000001";
const shade = "91000000-0000-4000-8000-000000000002";
const order = "91000000-0000-4000-8000-000000000003";
const actor = { accountId: id, sessionId: id };
const input = {
  patient: { internal_reference: "SYN-42" },
  requested_delivery_date: "2026-11-01",
  material_id: id,
  shade_id: shade,
  teeth: [],
  file_ids: [],
};
function fixture({ denied = false, rows = [] } = {}) {
  const query = vi.fn(async (sql) => {
    if (sql.startsWith("SELECT a.profile"))
      return {
        rows: denied
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
              },
            ],
      };
    if (sql.startsWith("SELECT id FROM public.clinics WHERE account_id=$1 AND"))
      return { rows: [{ id }] };
    if (sql.includes("FROM public.orders o")) return { rows };
    return { rows: [] };
  });
  return { query, transaction: vi.fn(async (fn) => fn({ query })) };
}

test("same-clinic current-version match is a hint without patient data or writes", async () => {
  const db = fixture({
    rows: [
      { order_id: order, number: "123", signal: "same_reference_and_work" },
    ],
  });
  const checked = await createOrderSimilarityService(db).check(actor, input);
  expect(checked).toEqual({
    kind: "checked",
    result: {
      matches: [
        { order_id: order, number: "123", signal: "same_reference_and_work" },
      ],
    },
  });
  const [sql, args] = db.query.mock.calls.find(([s]) =>
    s.includes("FROM public.orders o"),
  );
  expect(sql).toMatch(/o\.clinic_id=\$1 AND o\.kind='normal'/);
  expect(sql).toMatch(/v\.id=o\.current_version_id/);
  expect(sql).toMatch(/v\.requested_delivery_date=\$5::date/);
  expect(sql).toMatch(
    /m\.reference_id=\$6::uuid AND s\.reference_id=\$7::uuid/,
  );
  expect(sql).toMatch(/v\.patient_first_name.*v\.patient_last_name/s);
  expect(args).toEqual([id, "SYN-42", null, null, "2026-11-01", id, shade]);
  expect(JSON.stringify(checked.result)).not.toContain("SYN-42");
  expect(
    db.query.mock.calls.some(([s]) => /^(INSERT|UPDATE|DELETE)/.test(s)),
  ).toBe(false);
});

test("invalid input and revoked clinic never search orders", async () => {
  const db = fixture();
  expect(
    await createOrderSimilarityService(db).check(actor, {
      ...input,
      clinic_id: order,
    }),
  ).toEqual({ kind: "invalid" });
  expect(db.transaction).not.toHaveBeenCalled();
  const revoked = fixture({ denied: true });
  expect(
    await createOrderSimilarityService(revoked).check(actor, input),
  ).toEqual({ kind: "denied" });
  expect(
    revoked.query.mock.calls.some(([s]) => s.includes("FROM public.orders o")),
  ).toBe(false);
});

test("no match is nonblocking; strict response rejects patient disclosure", async () => {
  expect(
    await createOrderSimilarityService(fixture()).check(actor, input),
  ).toEqual({ kind: "checked", result: { matches: [] } });
  expect(OrderSimilarityInputSchema.safeParse(input).success).toBe(true);
  expect(
    OrderSimilarityResultSchema.safeParse({
      matches: [
        {
          order_id: order,
          number: "123",
          signal: "same_name_and_work",
          patient_name: "secret",
        },
      ],
    }).success,
  ).toBe(false);
});

test("browser client sends same-origin request and rejects malformed response", async () => {
  const transport = vi.fn(async () => ({
    status: 200,
    json: async () => ({ matches: [] }),
  }));
  const signal = new globalThis.AbortController().signal;
  expect(
    await createOrderSimilarityClient(transport).check(input, signal),
  ).toEqual({ matches: [] });
  expect(transport).toHaveBeenCalledWith(
    "/api/v1/orders/similar",
    expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal,
    }),
  );
  await expect(
    createOrderSimilarityClient(async () => ({
      status: 200,
      json: async () => ({ matches: [], patient_name: "secret" }),
    })).check(input, signal),
  ).rejects.toThrow();
});
