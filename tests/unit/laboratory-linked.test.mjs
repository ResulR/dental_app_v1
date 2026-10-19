import { test, expect, vi } from "vitest";
import {
  createLaboratoryLinkedWorkService,
  assertLaboratoryLinkedReady,
} from "../../apps/api/dist/modules/linked-works/index.js";
import { laboratoryLinkedEnabled } from "../../apps/api/dist/app/laboratory-linked-config.js";
import { createLaboratoryLinkedWorkClient } from "../../apps/web/src/features/orders/laboratory-linked-api.ts";
const id = "94000000-0000-4000-8000-000000000001",
  shade = "94000000-0000-4000-8000-000000000002",
  actor = { accountId: id, sessionId: id };
const grants = [
  "orders.read_logistics",
  "orders.read_details",
  "orders.create_for_clinic",
  "linked_works.manage",
  "orders.cancel",
];
const command = {
  source_order_id: id,
  expected_source_version_id: id,
  expected_source_revision: 1,
  kind: "replacement",
  reason: "Synthetic replacement reason",
  idempotency_key: id,
  confirmed_warnings: false,
  input: {
    patient: { internal_reference: "Synthetic new patient" },
    material_id: id,
    shade_id: shade,
    requested_delivery_date: null,
    description: "Synthetic new instructions",
    teeth: [{ fdi: 11, selection: "normal" }],
    file_ids: [],
  },
};
// Serial transaction double, NOT evidence of real PostgreSQL locking or constraint enforcement.
function fixture(patch = {}) {
  const state = {
      writes: [],
      receipts: {},
      sourceStatus: patch.status ?? "manufacturing",
      sourceRevision: 1,
    },
    calls = [];
  let queue = Promise.resolve();
  const transaction = vi.fn((fn) => {
    const task = queue.then(async () => {
      const draft = {
        ...state,
        writes: [...state.writes],
        receipts: { ...state.receipts },
      };
      let writes = 0,
        order;
      const query = async (sql, values = []) => {
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
                    grants: patch.grants ?? grants,
                  },
                ],
          };
        if (sql.startsWith("SELECT id,clinic_id FROM public.orders"))
          return {
            rows: patch.missing ? [] : [{ id: values[0], clinic_id: id }],
          };
        if (sql.startsWith("SELECT r.payload_fingerprint"))
          return {
            rows: draft.receipts[values[1]] ? [draft.receipts[values[1]]] : [],
          };
        if (sql.startsWith("SELECT id FROM public.catalog_references"))
          return { rows: values[0].map((id) => ({ id })) };
        if (sql.startsWith("SELECT id,kind,label"))
          return {
            rows: patch.catalogMissing
              ? []
              : [
                  {
                    id,
                    kind: "material",
                    label: "Synthetic material",
                    revision: "2",
                    state: patch.catalogState ?? "available",
                  },
                  {
                    id: shade,
                    kind: "shade",
                    label: "Synthetic shade",
                    revision: "3",
                    state: "available",
                  },
                ],
          };
        if (sql.startsWith("SELECT id,clinic_id,status"))
          return {
            rows: [
              {
                id: values[0],
                clinic_id: id,
                status: draft.sourceStatus,
                current_version_id: patch.version ?? id,
                revision: String(patch.stale ? 99 : draft.sourceRevision),
              },
            ],
          };
        if (sql.startsWith("INSERT") || sql.startsWith("UPDATE")) {
          writes++;
          if (writes === patch.failAt)
            throw new Error("SYNTHETIC_WRITE_FAILURE");
          draft.writes.push([sql, values]);
          if (sql.startsWith("INSERT INTO public.orders(")) {
            order = {
              order_id: values[0],
              number: "9007199254740993",
              received_at: new Date("2026-10-19T12:00:00Z"),
            };
            return { rows: [order] };
          }
          if (sql.startsWith("INSERT INTO public.submission_receipts"))
            draft.receipts[values[2]] = {
              ...order,
              payload_fingerprint: values[3],
            };
          if (sql.startsWith("UPDATE public.orders")) {
            if (patch.casFailure) return { rows: [] };
            draft.sourceStatus = "cancelled";
            draft.sourceRevision++;
            return { rows: [{ id }] };
          }
          if (sql.startsWith("UPDATE public.order_requests"))
            return { rows: patch.pending ? [{ id: shade }] : [] };
          return { rows: [] };
        }
        if (
          sql.startsWith("LOCK TABLE") ||
          /^SELECT id FROM public.(accounts|sessions)/.test(sql)
        )
          return { rows: [{ id }] };
        throw new Error("UNEXPECTED_SQL " + sql);
      };
      const result = await fn({ query });
      if (patch.commitFailure) throw new Error("COMMIT_UNCERTAIN");
      Object.assign(state, draft);
      return result;
    });
    queue = task.catch(() => {});
    return task;
  });
  return { transaction, state, calls };
}

test("R14 manufacturing replacement atomically creates accepted normal laboratory child, independent data and cancels source with reasons and both events", async () => {
  const db = fixture({ pending: true }),
    r = await createLaboratoryLinkedWorkService(db).submit(actor, command);
  expect(r.result).toMatchObject({
    kind: "submitted",
    persisted: true,
    replayed: false,
    number: "9007199254740993",
  });
  expect(r.result.order_id).not.toBe(id);
  expect(db.state.sourceStatus).toBe("cancelled");
  expect(db.state.sourceRevision).toBe(2);
  const w = db.state.writes,
    sql = w.map(([s]) => s).join("\n");
  expect(sql).toContain("'normal','laboratory'");
  expect(sql).toContain("$3,'accepted',1");
  expect(sql).toContain("'laboratory_order_created'");
  expect(sql).toContain("'order_cancelled'");
  expect(sql).toContain("'ORDER_REQUESTS_CLOSED'");
  for (const table of [
    "order_versions",
    "order_version_teeth",
    "order_logistics",
    "order_status_events",
    "conversations",
    "conversation_reads",
    "message_reminder_cycles",
    "outbox_dispatches",
    "audit_events",
    "submission_receipts",
    "work_links",
  ])
    expect(sql).toContain("INSERT INTO public." + table + "(");
  const link = w.find(([s]) =>
    s.startsWith("INSERT INTO public.work_links"),
  )[1];
  expect(link.slice(0, 6)).toEqual([
    id,
    r.result.order_id,
    id,
    "replacement",
    1,
    "manufacturing",
  ]);
  expect(link[7]).toBe(command.reason);
  const sourceEvent = w.find(([s]) =>
    s.includes("'manufacturing','cancelled'"),
  )[1];
  expect(sourceEvent).toEqual([id, id, id, command.reason, id, 2]);
  expect(
    w.find(([s]) => s.startsWith("INSERT INTO public.order_versions"))[1][6],
  ).toBe("Synthetic new patient");
  expect(
    w.filter(([s]) => s.startsWith("UPDATE")).map(([s]) => s),
  ).toHaveLength(2);
  const catalogIndex = db.calls.findIndex(([s]) =>
      s.startsWith("SELECT id,kind,label"),
    ),
    sourceIndex = db.calls.findIndex(([s]) =>
      s.startsWith("SELECT id,clinic_id,status"),
    );
  expect(catalogIndex).toBeLessThan(sourceIndex);
  expect(db.calls[sourceIndex][0]).toContain("FOR UPDATE");
});

test("R14 terminal replacements and all supplements preserve source status revision instructions delivery and conversation", async () => {
  for (const status of ["manufacturing", "completed", "delivered"])
    for (const kind of ["replacement", "supplement"]) {
      if (status === "manufacturing" && kind === "replacement") continue;
      const db = fixture({
          status,
          grants: grants.filter((g) => g !== "orders.cancel"),
        }),
        r = await createLaboratoryLinkedWorkService(db).submit(actor, {
          ...command,
          kind,
          ...(kind === "supplement" ? { reason: undefined } : {}),
        });
      expect(r.result.kind).toBe("submitted");
      expect(db.state.sourceStatus).toBe(status);
      expect(db.state.sourceRevision).toBe(1);
      expect(
        db.state.writes.some(
          ([s]) => s.startsWith("UPDATE") || s.startsWith("DELETE"),
        ),
      ).toBe(false);
    }
});

test("current authority, permission prerequisites, status and source CAS deny without writes", async () => {
  for (const patch of [
    { denied: true },
    { profile: "clinic" },
    { suspended: true },
    { grants: grants.filter((g) => g !== "orders.create_for_clinic") },
    { grants: grants.filter((g) => g !== "linked_works.manage") },
    { grants: grants.filter((g) => g !== "orders.read_details") },
    { grants: grants.filter((g) => g !== "orders.cancel") },
    { missing: true },
  ]) {
    const db = fixture(patch);
    expect(
      (await createLaboratoryLinkedWorkService(db).submit(actor, command)).kind,
    ).toBe("denied");
    expect(db.state.writes).toEqual([]);
  }
  for (const patch of [
    { status: "pending" },
    { status: "accepted" },
    { status: "correction_requested" },
    { status: "rejected" },
    { status: "cancelled" },
    { stale: true },
    { version: shade },
  ]) {
    const db = fixture(patch);
    expect(
      (await createLaboratoryLinkedWorkService(db).submit(actor, command))
        .result.kind,
    ).toBe("source_unavailable");
    expect(db.state.writes).toEqual([]);
  }
  for (const bad of [
    { ...command, reason: " " },
    { ...command, clinic_id: shade },
    { ...command, input: { ...command.input, origin: "clinic" } },
    {
      ...command,
      input: { ...command.input, patient: { first_name: "Only" } },
    },
  ]) {
    const db = fixture();
    expect(
      (await createLaboratoryLinkedWorkService(db).submit(actor, bad)).kind,
    ).toBe("invalid");
    expect(db.transaction).not.toHaveBeenCalled();
  }
});

test("replay reconciles after source cancellation; different payload conflicts; simultaneous distinct replacements cannot both cancel same revision", async () => {
  const db = fixture(),
    svc = createLaboratoryLinkedWorkService(db),
    [a, b] = await Promise.all([
      svc.submit(actor, command),
      svc.submit(actor, command),
    ]);
  expect(a.result.replayed).toBe(false);
  expect(b.result).toEqual({ ...a.result, replayed: true });
  const count = db.state.writes.length;
  expect(
    (
      await svc.submit(actor, {
        ...command,
        input: { ...command.input, description: "Changed" },
      })
    ).result.kind,
  ).toBe("conflict");
  expect(db.state.writes.length).toBe(count);
  const db2 = fixture(),
    svc2 = createLaboratoryLinkedWorkService(db2),
    rs = await Promise.all([
      svc2.submit(actor, command),
      svc2.submit(actor, { ...command, idempotency_key: shade }),
    ]);
  expect(rs.map((r) => r.result.kind)).toEqual([
    "submitted",
    "source_unavailable",
  ]);
});

test("catalogue forbiddance, missing references, unavailable exceptional acceptance and files fail closed", async () => {
  for (const patch of [
    { catalogState: "forbidden" },
    { catalogMissing: true },
  ]) {
    const db = fixture(patch);
    expect(
      (await createLaboratoryLinkedWorkService(db).submit(actor, command))
        .result.kind,
    ).toBe("blocked");
    expect(db.state.writes).toEqual([]);
  }
  const files = fixture();
  expect(
    (
      await createLaboratoryLinkedWorkService(files).submit(actor, {
        ...command,
        input: { ...command.input, file_ids: [id] },
      })
    ).result,
  ).toMatchObject({ kind: "blocked", reasons: ["files_not_ready"] });
  expect(files.state.writes).toEqual([]);
  for (const extra of [
    {},
    { confirmed_warnings: true },
    { exception_reason: "Justified" },
  ]) {
    const db = fixture({ catalogState: "unavailable" });
    expect(
      (
        await createLaboratoryLinkedWorkService(db).submit(actor, {
          ...command,
          ...extra,
        })
      ).result.kind,
    ).toBe("exception_required");
    expect(db.state.writes).toEqual([]);
  }
  const db = fixture({ catalogState: "unavailable" });
  expect(
    (
      await createLaboratoryLinkedWorkService(db).submit(actor, {
        ...command,
        confirmed_warnings: true,
        exception_reason: "Synthetic exception",
      })
    ).result.kind,
  ).toBe("submitted");
  expect(
    db.state.writes.find(([s]) => s.includes("NULL,'accepted'"))[1][4],
  ).toBe("Synthetic exception");
  const low = fixture();
  expect(
    (
      await createLaboratoryLinkedWorkService(low).submit(actor, {
        ...command,
        input: { ...command.input, teeth: [], description: "" },
      })
    ).result,
  ).toMatchObject({ kind: "confirmation_required", warnings: ["low_detail"] });
  expect(low.state.writes).toEqual([]);
});

test("failure at every child/link/source write, failed CAS and uncertain commit never report success and roll back double", async () => {
  const base = fixture({ pending: true });
  await createLaboratoryLinkedWorkService(base).submit(actor, command);
  for (let failAt = 1; failAt <= base.state.writes.length; failAt++) {
    const db = fixture({ failAt, pending: true });
    await expect(
      createLaboratoryLinkedWorkService(db).submit(actor, command),
    ).rejects.toThrow("SYNTHETIC_WRITE_FAILURE");
    expect(db.state.writes).toEqual([]);
    expect(db.state.sourceStatus).toBe("manufacturing");
    expect(db.state.receipts).toEqual({});
  }
  for (const patch of [{ casFailure: true }, { commitFailure: true }]) {
    const db = fixture(patch);
    await expect(
      createLaboratoryLinkedWorkService(db).submit(actor, command),
    ).rejects.toThrow();
    expect(db.state.writes).toEqual([]);
    expect(db.state.sourceStatus).toBe("manufacturing");
  }
});

test("configuration stays disabled; readiness failure is fatal; client verifies actual receipt and never retries transport", async () => {
  expect(laboratoryLinkedEnabled({})).toBe(false);
  expect(() =>
    laboratoryLinkedEnabled({ DENTAL_LAB_LABORATORY_LINKED_ENABLED: "true" }),
  ).toThrow();
  expect(
    laboratoryLinkedEnabled({
      DENTAL_LAB_LABORATORY_LINKED_ENABLED: "true",
      DENTAL_LAB_ORDER_SUBMISSION_ENABLED: "true",
      DENTAL_LAB_ORDER_REQUEST_ENABLED: "true",
    }),
  ).toBe(true);
  await expect(
    assertLaboratoryLinkedReady({
      query: async () => ({ rows: [{ ready: false }] }),
    }),
  ).rejects.toThrow("LABORATORY_LINKED_STORAGE_NOT_READY");
  await assertLaboratoryLinkedReady({
    query: async () => ({ rows: [{ ready: true }] }),
  });
  const transport = vi.fn(async () => ({ status: 503 })),
    client = createLaboratoryLinkedWorkClient(transport),
    signal = new globalThis.AbortController().signal;
  await expect(client.submit(command, signal)).rejects.toThrow();
  expect(transport).toHaveBeenCalledTimes(1);
  expect(transport.mock.calls[0][1]).toMatchObject({
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    signal,
  });
  const fake = vi.fn(async () => ({
    status: 200,
    json: async () => ({ ok: true }),
  }));
  await expect(
    createLaboratoryLinkedWorkClient(fake).submit(command, signal),
  ).rejects.toThrow();
});
