import { test, expect } from "vitest";
import { createDeadlineNoticeRepository } from "../../apps/api/dist/modules/notifications/deadline-notice.repository.js";

const orderId = "91000000-0000-4000-8000-000000000001";
const clinicId = "91000000-0000-4000-8000-000000000002";
const ownerId = "91000000-0000-4000-8000-000000000003";

// Transactional double: it checks the service's SQL intent and rollback, not
// PostgreSQL row locking, grants, timezone behavior or unique constraints.
function fixture() {
  const state = {
    revision: 1,
    due: "order_due_soon",
    closed: false,
    owner: true,
    events: [],
    notices: [],
  };
  let queue = Promise.resolve();
  return {
    state,
    transaction(work) {
      const job = queue.then(async () => {
        const draft = structuredClone(state);
        const tx = {
          query: async (sql, values = []) => {
            if (sql.includes("FOR UPDATE OF o SKIP LOCKED")) {
              expect(sql).toContain(
                "planned_delivery_date,v.requested_delivery_date",
              );
              expect(sql).toContain(
                "NOT IN ('delivered','rejected','cancelled')",
              );
              return {
                rows:
                  draft.closed ||
                  draft.events.some(
                    (e) =>
                      e.revision === draft.revision && e.kind === draft.due,
                  )
                    ? []
                    : [
                        {
                          id: orderId,
                          clinic_id: clinicId,
                          revision: String(draft.revision),
                          kind: draft.due,
                        },
                      ],
              };
            }
            if (sql.includes("INSERT INTO public.outbox_events")) {
              expect(sql).toContain(
                "ON CONFLICT (aggregate_type,aggregate_id,aggregate_revision,type) DO NOTHING",
              );
              expect(sql).not.toContain("outbox_dispatches");
              const [, kind, , revision] = values;
              if (
                draft.events.some(
                  (e) => e.revision === Number(revision) && e.kind === kind,
                )
              )
                return { rows: [] };
              draft.events.push({
                id: values[0],
                kind,
                revision: Number(revision),
              });
              return { rows: [{ id: values[0] }] };
            }
            if (sql.includes("FROM public.owner_slot"))
              return { rows: draft.owner ? [{ id: ownerId }] : [] };
            if (sql.includes("INSERT INTO public.internal_notifications")) {
              draft.notices.push(values);
              return { rows: [{ id: values[0] }] };
            }
            throw new Error("Unexpected SQL: " + sql);
          },
        };
        const result = await work(tx);
        Object.assign(state, draft);
        return result;
      });
      queue = job.catch(() => {});
      return job;
    },
  };
}
test("one durable owner notice per kind and revision; replan and late event are distinct", async () => {
  const db = fixture(),
    service = createDeadlineNoticeRepository(db);
  expect((await service.generateBatch()).created).toBe(1);
  expect((await service.generateBatch()).created).toBe(0);
  db.state.due = "order_overdue";
  expect((await service.generateBatch()).created).toBe(1);
  db.state.revision++;
  expect((await service.generateBatch()).created).toBe(1);
  expect(db.state.notices).toHaveLength(3);
  db.state.closed = true;
  expect((await service.generateBatch()).created).toBe(0);
});
test("concurrent calls deduplicate; missing current owner rolls back the event", async () => {
  const db = fixture(),
    service = createDeadlineNoticeRepository(db);
  const results = await Promise.all([
    service.generateBatch(),
    service.generateBatch(),
  ]);
  expect(results.map((r) => r.created).sort()).toEqual([0, 1]);
  db.state.revision++;
  db.state.owner = false;
  await expect(service.generateBatch()).rejects.toThrow(
    "DEADLINE_NOTICE_OWNER_UNAVAILABLE",
  );
  expect(db.state.events).toHaveLength(1);
});
