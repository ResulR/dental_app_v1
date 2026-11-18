import { test, expect, vi } from "vitest";
import {
  createEmailQueueReadRepository,
  assertEmailQueueReadReady,
} from "../../apps/api/dist/modules/notifications/email-queue-read.repository.js";
import { emailQueueReadEnabled } from "../../apps/api/dist/app/email-queue-read-config.js";
const id = "94000000-0000-4000-8000-000000000001";
const actor = { accountId: id, sessionId: id };
function fixture(profile = "owner", count = 1) {
  const query = vi.fn(async (sql) => {
    if (sql.startsWith("SELECT a.profile"))
      return {
        rows: [
          {
            profile,
            lifecycle: "active",
            securityLocked: false,
            resetRequired: false,
            sessionValid: true,
            ownerCurrent: profile === "owner",
            clinicId: null,
            clinicSuspended: false,
            grants: [],
          },
        ],
      };
    if (sql.includes("FROM public.notification_deliveries d"))
      return {
        rows: Array.from({ length: count }, (_, index) => ({
          id: "94000000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
          created_at: new Date("2026-11-18T10:00:00Z"),
          event_type: "order_accepted",
          purpose: "business",
          state: "failed",
          attempt_count: 1,
          next_attempt_at: new Date("2026-11-18T11:00:00Z"),
          last_result: "ambiguous",
          last_error_code: "LEASE_EXPIRED",
          last_attempt_at: new Date("2026-11-18T10:05:00Z"),
          cancellation_code: null,
          // An accidental SELECT * must never survive the strict projection.
          patient_name: "forbidden",
          provider_id: "forbidden",
        })),
      };
    return { rows: [] };
  });
  return { query, transaction: vi.fn((work) => work({ query })) };
}
test("current owner sees a bounded, minimal status page and a stable cursor", async () => {
  const db = fixture("owner", 51);
  const result = await createEmailQueueReadRepository(db).page(actor, {
    state: "failed",
  });
  expect(result.kind).toBe("result");
  expect(result.result.items).toHaveLength(50);
  expect(result.result.next_before).toEqual({
    created_at: "2026-11-18T10:00:00.000Z",
    id: "94000000-0000-4000-8000-000000000050",
  });
  expect(result.result.items[0]).toMatchObject({
    state: "failed",
    last_result: "ambiguous",
  });
  expect(JSON.stringify(result.result)).not.toMatch(
    /patient_name|provider_id|forbidden/,
  );
  const [sql, params] = db.query.mock.calls.find(([statement]) =>
    statement.includes("FROM public.notification_deliveries d"),
  );
  expect(sql).toContain("(d.created_at,d.id)<($2::timestamptz,$3::uuid)");
  expect(sql).toContain("LIMIT 51");
  expect(sql).not.toMatch(/SELECT \*/);
  expect(params).toEqual(["failed", null, null]);
});
test.each(["clinic", "admin", "employee"])(
  "non-owner %s cannot query the queue",
  async (profile) => {
    const db = fixture(profile);
    expect(
      (await createEmailQueueReadRepository(db).page(actor, {})).kind,
    ).toBe("denied");
    expect(
      db.query.mock.calls.some(([sql]) =>
        sql.includes("FROM public.notification_deliveries d"),
      ),
    ).toBe(false);
  },
);
test("invalid filter and storage gate fail closed", async () => {
  const db = fixture();
  expect(
    (
      await createEmailQueueReadRepository(db).page(actor, {
        target_account_id: id,
      })
    ).kind,
  ).toBe("invalid");
  expect(db.transaction).not.toHaveBeenCalled();
  expect(emailQueueReadEnabled({})).toBe(false);
  expect(() =>
    emailQueueReadEnabled({ DENTAL_LAB_EMAIL_QUEUE_READ_ENABLED: "yes" }),
  ).toThrow();
  const readiness = {
    query: vi.fn(async () => ({ rows: [{ ready: false }] })),
  };
  await expect(assertEmailQueueReadReady(readiness)).rejects.toThrow(
    "EMAIL_QUEUE_READ_UNAVAILABLE",
  );
});
