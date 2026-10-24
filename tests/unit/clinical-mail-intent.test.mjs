import { expect, test, vi } from "vitest";
import { createClinicalMailIntentRepository } from "../../apps/api/dist/modules/notifications/clinical-mail-intent.repository.js";
const id = "91000000-0000-4000-8000-000000000001";
function fixture({
  type = "order_accepted",
  state = "pending",
  recipient = true,
  fail = false,
} = {}) {
  const writes = [],
    calls = [];
  const query = vi.fn(async (sql, args) => {
    calls.push([sql, args]);
    if (sql.startsWith("SELECT e.type,d.state"))
      return { rows: type ? [{ type, state }] : [] };
    if (sql.startsWith("INSERT INTO public.notification_deliveries")) {
      if (fail) throw Error("INTENT_FAILURE");
      if (recipient && !writes.length) {
        writes.push(args);
        return { rows: [{ id }] };
      }
      return { rows: [] };
    }
    throw Error("UNEXPECTED_SQL");
  });
  const transaction = async (work) => {
    const previous = writes.length;
    try {
      return await work({ query });
    } catch (error) {
      writes.length = previous;
      throw error;
    }
  };
  return {
    repository: createClinicalMailIntentRepository({ transaction }),
    calls,
    writes,
  };
}
test("only listed clinic decisions prepare one durable, private, deduplicated intent", async () => {
  const f = fixture();
  expect(await f.repository.prepare(id)).toBe("prepared");
  expect(await f.repository.prepare(id)).toBe("skipped");
  expect(f.writes).toEqual([[id]]);
  const insert = f.calls.find(([sql]) =>
    sql.startsWith("INSERT INTO public.notification_deliveries"),
  )[0];
  expect(insert).toContain(
    "ON CONFLICT(event_id,target_account_id,channel,purpose) DO NOTHING",
  );
  expect(insert).toContain("c.review_state='approved' AND NOT c.suspended");
  expect(insert).not.toMatch(/email_original|patient_reference|body/);
  for (const type of [
    "message_created",
    "order_delivered",
    "clinic_registered",
    null,
  ]) {
    const rejected = fixture({ type });
    expect(await rejected.repository.prepare(id)).toBe("skipped");
    expect(rejected.writes).toEqual([]);
  }
  for (const patch of [{ state: "failed" }, { recipient: false }])
    expect(await fixture(patch).repository.prepare(id)).toBe("skipped");
});
test("intent error aborts the transaction; transport is absent", async () => {
  const f = fixture({ fail: true });
  await expect(f.repository.prepare(id)).rejects.toThrow("INTENT_FAILURE");
  expect(f.writes).toEqual([]);
});
