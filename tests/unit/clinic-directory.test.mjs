import { test, expect, vi } from "vitest";
import { createClinicManagementRepository } from "../../apps/api/dist/modules/clinics/index.js";
import { createClinicReviewClient } from "../../apps/web/src/features/clinics/review-api.ts";
const id = "70000000-0000-4000-8000-000000000001";
const rows = Array.from({ length: 51 }, (_, n) => ({
  id: "70000000-0000-4000-8000-" + String(n + 2).padStart(12, "0"),
  name: "Fixture " + n,
  revision: "2",
  review_state: ["pending", "approved", "refused"][n % 3],
  suspended: n === 3,
}));
function store(patch = {}) {
  const query = vi.fn(async (sql) => {
    if (sql.includes("SELECT s.id"))
      return { rows: patch.revoked ? [] : [{ id }] };
    if (sql.includes("SELECT a.profile"))
      return {
        rows: [
          {
            profile: patch.profile ?? "admin",
            owner: patch.owner ?? false,
            managed: patch.managed ?? true,
          },
        ],
      };
    if (sql.startsWith("SELECT id,name,")) return { rows: patch.rows ?? rows };
    return { rows: [] };
  });
  return { query, transaction: async (fn) => fn({ query }) };
}
const identity = { accountId: id, sessionId: id, profile: "admin" };
test("directory includes approved/refused/suspended clinics in bounded keyset pages without contact data", async () => {
  const db = store(),
    page = await createClinicManagementRepository(db, identity).directory(id);
  expect(page.items).toHaveLength(50);
  expect(page.next_after).toBe(rows[49].id);
  expect(page.items.map((r) => r.review_state)).toContain("approved");
  expect(page.items[3].suspended).toBe(true);
  const call = db.query.mock.calls.find(([sql]) =>
    sql.startsWith("SELECT id,name,"),
  );
  expect(call[1]).toEqual([id]);
  expect(call[0]).toContain("id>$1");
  expect(call[0]).toContain("LIMIT 51");
  expect(call[0]).not.toMatch(/phone|email|address|dentist|patient|password/);
  expect(
    db.query.mock.calls.some(([sql]) => /^(INSERT|UPDATE|DELETE)/.test(sql)),
  ).toBe(false);
  expect(
    (
      await createClinicManagementRepository(
        store({ rows: [] }),
        identity,
      ).directory()
    ).next_after,
  ).toBeNull();
});
test("clinic identities, revoked sessions and removed manager rights never read directory", async () => {
  for (const patch of [
    { profile: "clinic" },
    { managed: false },
    { revoked: true },
    { profile: "owner", owner: false },
  ]) {
    const db = store(patch);
    expect(
      await createClinicManagementRepository(db, {
        ...identity,
        profile: patch.profile ?? "admin",
      }).directory(),
    ).toBeNull();
    expect(
      db.query.mock.calls.some(([sql]) => sql.startsWith("SELECT id,name,")),
    ).toBe(false);
  }
});
test("directory transport rejects malformed cursors and response fields and uses no-store", async () => {
  const response = { items: [{ ...rows[0], revision: 2 }], next_after: null };
  const fetcher = vi.fn(
    async () => new globalThis.Response(JSON.stringify(response)),
  );
  const api = createClinicReviewClient(fetcher),
    signal = new globalThis.AbortController().signal;
  expect(await api.directory(signal, "bad")).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
  expect(await api.directory(signal, id)).toEqual(response);
  expect(fetcher.mock.calls[0][0]).toBe(
    "/api/v1/clinics/directory?after=" + id,
  );
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    signal,
  });
  response.items[0].private_data = "not allowed";
  expect(await api.directory(signal)).toBeNull();
});
