import { expect, test, vi } from "vitest";
import {
  appendLaboratoryOrderMailIntent,
  createLaboratoryOrderMailIntentRepository,
} from "../../apps/api/dist/modules/notifications/laboratory-mail-intent.repository.js";

const eventId = "91000000-0000-4000-8000-000000000001";
function fixture({
  type = "order_submitted",
  state = "pending",
  owner = true,
  current = true,
  senderMatched = true,
  recipient = true,
  fail = false,
  failOnce = false,
} = {}) {
  const rows = [],
    calls = [];
  let pendingFailure = failOnce;
  const query = vi.fn(async (sql, args = []) => {
    calls.push([sql, args]);
    if (sql.startsWith("SELECT e.type,d.state"))
      return { rows: type ? [{ type, state }] : [] };
    if (sql.startsWith("SELECT o.id FROM public.outbox_events"))
      return { rows: current && senderMatched ? [{ id: eventId }] : [] };
    if (sql.startsWith("SELECT a.id FROM public.owner_slot"))
      return { rows: owner ? [{ id: eventId }] : [] };
    if (sql.startsWith("INSERT INTO public.notification_deliveries")) {
      if (fail || pendingFailure) {
        pendingFailure = false;
        throw Error("INTENT_INSERT_FAILED");
      }
      if (recipient && !rows.length) {
        rows.push({ id: eventId });
        return { rows: [{ id: eventId }] };
      }
      return { rows: [] };
    }
    throw Error("UNEXPECTED_SQL");
  });
  const transaction = async (work) => {
    const count = rows.length;
    try {
      return await work({ query });
    } catch (error) {
      rows.length = count;
      throw error;
    }
  };
  return {
    repository: createLaboratoryOrderMailIntentRepository({ transaction }),
    transaction,
    rows,
    calls,
  };
}
test("five configured order categories prepare owner and eligible admin intents only", async () => {
  for (const type of [
    "order_submitted",
    "modification_requested",
    "cancellation_requested",
    "retouch_requested",
    "correction_resubmitted",
  ]) {
    const f = fixture({ type });
    expect(await f.repository.prepare(eventId)).toBe("prepared");
    expect(await f.repository.prepare(eventId)).toBe("skipped");
    const lock = f.calls.find(([sql]) =>
      sql.startsWith("SELECT e.type,d.state"),
    )[0];
    expect(lock).toContain("FOR UPDATE OF d");
    const insert = f.calls.find(([sql]) =>
      sql.startsWith("INSERT INTO public.notification_deliveries"),
    );
    expect(insert[1]).toEqual([eventId, type]);
    expect(insert[0]).toContain("o.revision=e.aggregate_revision");
    expect(insert[0]).toContain("sender.account_id=e.actor_id");
    expect(insert[0]).toContain("r.category=$2 AND r.account_id=a.id");
    expect(insert[0]).toContain("g.permission_code='orders.read_details'");
    expect(insert[0]).toContain("g.permission_code='orders.read_logistics'");
    expect(insert[0]).toContain(
      "ON CONFLICT(event_id,target_account_id,channel,purpose) DO NOTHING",
    );
    expect(insert[0]).not.toMatch(
      /email_original|patient_reference|body|message_text/,
    );
  }
});
test("excluded events, obsolete revisions and unavailable recipients fail closed", async () => {
  for (const type of [
    "clinic_registered",
    "message_created",
    "order_delivered",
    null,
  ])
    expect(await fixture({ type }).repository.prepare(eventId)).toBe("skipped");
  for (const options of [
    { state: "failed" },
    { current: false },
    { senderMatched: false },
    { recipient: false },
  ])
    expect(await fixture(options).repository.prepare(eventId)).toBe("skipped");
  await expect(
    fixture({ owner: false }).repository.prepare(eventId),
  ).rejects.toThrow("LABORATORY_MAIL_OWNER_UNAVAILABLE");
});
test("producer rollback, failed insert and retry preserve one intent", async () => {
  const f = fixture();
  await expect(
    f.transaction(async (tx) => {
      expect(await appendLaboratoryOrderMailIntent(tx, eventId)).toBe(
        "prepared",
      );
      throw Error("ROLLBACK");
    }),
  ).rejects.toThrow("ROLLBACK");
  expect(f.rows).toEqual([]);
  expect(await f.repository.prepare(eventId)).toBe("prepared");
  expect(await f.repository.prepare(eventId)).toBe("skipped");
  expect(f.rows).toHaveLength(1);
  const error = fixture({ fail: true });
  await expect(error.repository.prepare(eventId)).rejects.toThrow(
    "INTENT_INSERT_FAILED",
  );
  expect(error.rows).toEqual([]);
  const transient = fixture({ failOnce: true });
  await expect(transient.repository.prepare(eventId)).rejects.toThrow(
    "INTENT_INSERT_FAILED",
  );
  expect(transient.rows).toEqual([]);
  expect(await transient.repository.prepare(eventId)).toBe("prepared");
  expect(await transient.repository.prepare(eventId)).toBe("skipped");
  expect(transient.rows).toHaveLength(1);
});
