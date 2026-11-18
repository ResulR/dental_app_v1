import { expect, test } from "vitest";
import { createMessageReminderRepository } from "../../apps/api/dist/modules/notifications/message-reminder.repository.js";

const conversation = "91000000-0000-4000-8000-000000000001";
const clinic = "91000000-0000-4000-8000-000000000002";
const recipient = "91000000-0000-4000-8000-000000000003";
// Transactional double: timestamps, locks and grants still require PostgreSQL reception.
function fixture() {
  const state = {
    read: 0,
    eligible: 2,
    reminded: 0,
    lastAt: null,
    now: 60,
    revision: 1,
    cycle: conversation,
    active: true,
    events: [],
    deliveries: [],
  };
  let queue = Promise.resolve();
  return {
    state,
    db: {
      transaction(work) {
        const job = queue.then(async () => {
          const draft = structuredClone(state);
          const tx = {
            async query(sql, args = []) {
              if (sql.includes("FOR UPDATE OF c SKIP LOCKED"))
                return {
                  rows:
                    draft.eligible > draft.read
                      ? [
                          {
                            id: conversation,
                            clinic_id: clinic,
                            kind: "general",
                          },
                        ]
                      : [],
                };
              if (sql.startsWith("INSERT INTO public.message_reminder_cycles"))
                return { rows: [] };
              if (sql.includes("FOR UPDATE OF cy"))
                return {
                  rows: [
                    {
                      cycle_id: draft.cycle,
                      last_reminded_seq: String(draft.reminded),
                      last_reminder_at: draft.lastAt,
                      revision: String(draft.revision),
                      last_read_seq: String(draft.read),
                    },
                  ],
                };
              if (sql.includes("max(m.sequence_number) FILTER"))
                return {
                  rows: [
                    {
                      first_at:
                        draft.eligible > draft.read ? new Date(0) : null,
                      eligible_seq:
                        draft.eligible > draft.read
                          ? String(draft.eligible)
                          : null,
                    },
                  ],
                };
              if (sql.includes("FROM public.clinics c JOIN public.accounts a"))
                return { rows: draft.active ? [{ id: recipient }] : [] };
              if (sql.includes("FROM public.email_category_recipients"))
                return { rows: [] };
              if (
                sql.startsWith(
                  "UPDATE public.message_reminder_cycles SET last_reminded_seq",
                )
              ) {
                expect(sql).toContain("interval '24 hours'");
                if (
                  draft.lastAt &&
                  draft.now - draft.lastAt.getTime() / 60000 < 1440
                )
                  return { rows: [] };
                draft.reminded = Number(args[2]);
                draft.lastAt = new Date(draft.now * 60000);
                draft.revision++;
                return { rows: [{ revision: String(draft.revision) }] };
              }
              if (sql.startsWith("INSERT INTO public.outbox_events")) {
                expect(sql).toContain("'message_reminder','process'");
                draft.events.push(args);
                return { rows: [] };
              }
              if (
                sql.startsWith("INSERT INTO public.notification_deliveries")
              ) {
                draft.deliveries.push(args);
                return { rows: [] };
              }
              if (
                sql.startsWith(
                  "UPDATE public.message_reminder_cycles SET cycle_id",
                )
              ) {
                draft.reminded = 0;
                draft.lastAt = null;
                draft.cycle = args[2];
                draft.revision++;
                return { rows: [] };
              }
              return { rows: [] };
            },
          };
          const result = await work(tx);
          Object.assign(state, draft);
          return result;
        });
        queue = job.catch(() => {});
        return job;
      },
    },
  };
}
test("one intent per unread cycle, later arrivals require 24h and a new eligible sequence", async () => {
  const { state, db } = fixture();
  const repo = createMessageReminderRepository(db);
  expect(
    (await Promise.all([repo.generateBatch(), repo.generateBatch()])).map(
      (x) => x.created,
    ),
  ).toEqual([1, 0]);
  state.now += 1500;
  expect((await repo.generateBatch()).created).toBe(0);
  state.eligible = 3;
  state.now += 5;
  expect((await repo.generateBatch()).created).toBe(1);
  expect(state.events).toHaveLength(2);
  expect(state.deliveries).toHaveLength(2);
});
test("suspended recipient, complete read and not-yet-old arrivals create no intent", async () => {
  const { state, db } = fixture();
  const repo = createMessageReminderRepository(db);
  state.active = false;
  expect((await repo.generateBatch()).created).toBe(0);
  state.active = true;
  state.read = 2;
  expect((await repo.generateBatch()).created).toBe(0);
  state.eligible = 2;
  expect((await repo.generateBatch()).created).toBe(0);
  expect(state.events).toHaveLength(0);
});
