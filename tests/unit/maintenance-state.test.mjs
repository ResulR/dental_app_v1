import { test, expect } from "vitest";
import { createMaintenanceStateRepository } from "../../apps/api/dist/modules/settings/maintenance-state.repository.js";
const id = "91000000-0000-4000-8000-000000000001",
  actor = { accountId: id, sessionId: id };
function fixture(profile = "owner") {
  const state = {
    revision: 0,
    active: false,
    message: "",
    planned_at: null,
    planned_message: "",
    events: [],
    audit: [],
  };
  let queue = Promise.resolve();
  return {
    state,
    transaction(work) {
      const job = queue.then(async () => {
        const draft = structuredClone(state);
        const tx = {
          query: async (sql, values = []) => {
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
            if (sql.startsWith("SELECT active,message"))
              return { rows: [{ ...draft, revision: String(draft.revision) }] };
            if (sql.startsWith("UPDATE public.maintenance_state")) {
              draft.active = values[0];
              draft.message = values[1];
              draft.planned_at = values[2];
              draft.planned_message = values[3];
              draft.revision = values[4];
              return { rows: [{ revision: String(draft.revision) }] };
            }
            if (sql.startsWith("INSERT INTO public.maintenance_events")) {
              draft.events.push(values);
              return { rows: [] };
            }
            if (sql.startsWith("INSERT INTO public.audit_events")) {
              draft.audit.push(values);
              return { rows: [] };
            }
            if (sql.startsWith("SELECT revision::text,actor_id"))
              return { rows: draft.events };
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
  };
}
const command = {
  expected_revision: 0,
  active: true,
  message: "Mirëmbajtje",
  planned_at: null,
  planned_message: "",
};
test("owner-only CAS and atomic history", async () => {
  const db = fixture(),
    repository = createMaintenanceStateRepository(db);
  expect((await repository.update(actor, command)).kind).toBe("applied");
  expect(db.state.active).toBe(true);
  expect(db.state.events).toHaveLength(1);
  expect(db.state.audit).toHaveLength(1);
  expect((await repository.update(actor, command)).kind).toBe("conflict");
  expect(db.state.events).toHaveLength(1);
});
test("no empty active message and no delegated access", async () => {
  const db = fixture("admin"),
    repository = createMaintenanceStateRepository(db);
  expect((await repository.update(actor, command)).kind).toBe("denied");
  expect(db.state.events).toHaveLength(0);
  expect(
    (
      await createMaintenanceStateRepository(fixture()).update(actor, {
        ...command,
        message: "",
      })
    ).kind,
  ).toBe("invalid");
});

test("planned notice can be cancelled without activating maintenance", async () => {
  const db = fixture(),
    repo = createMaintenanceStateRepository(db);
  expect(
    (
      await repo.update(actor, {
        ...command,
        active: false,
        message: "",
        planned_at: "2026-11-06T12:00:00Z",
        planned_message: "Njoftim",
      })
    ).kind,
  ).toBe("applied");
  expect(db.state.active).toBe(false);
  expect(
    (
      await repo.update(actor, {
        expected_revision: 1,
        active: false,
        message: "",
        planned_at: null,
        planned_message: "",
      })
    ).kind,
  ).toBe("applied");
  expect(db.state.planned_at).toBeNull();
  expect(db.state.events).toHaveLength(2);
});

test("authenticated non-owner reads only the notice; owner retains control", async () => {
  const db = fixture("admin"),
    repo = createMaintenanceStateRepository(db);
  expect((await repo.notice(actor)).active).toBe(false);
  expect(await repo.read(actor)).toBeNull();
  expect((await repo.update(actor, command)).kind).toBe("denied");
});
