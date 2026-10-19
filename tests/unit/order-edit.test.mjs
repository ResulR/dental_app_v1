import { test, expect, vi } from "vitest";
import { createOrderEditService } from "../../apps/api/dist/modules/orders/index.js";
const id = "91000000-0000-4000-8000-000000000001",
  shade = "91000000-0000-4000-8000-000000000002",
  other = "91000000-0000-4000-8000-000000000003",
  actor = { accountId: id, sessionId: id };
const input = {
  patient: { internal_reference: "Synthetic" },
  material_id: id,
  shade_id: shade,
  requested_delivery_date: "2026-11-01",
  description: "Synthetic instructions",
  teeth: [{ fdi: 11, selection: "normal" }],
  file_ids: [],
};
const command = {
  order_id: id,
  expected_version_id: id,
  expected_revision: 1,
  action: "save",
  confirmed_warnings: false,
  input,
};
function fixture(patch = {}) {
  const state = {
      status: patch.status ?? "pending",
      version: id,
      revision: 1,
      writes: [],
    },
    calls = [];
  let queue = Promise.resolve();
  const transaction = vi.fn((fn) => {
    const task = queue.then(async () => {
      const draft = { ...state, writes: [...state.writes] };
      const query = async (sql, values = []) => {
        calls.push([sql, values]);
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
                    ownerCurrent: patch.ownerCurrent ?? true,
                    clinicId: id,
                    clinicSuspended: patch.suspended ?? false,
                    grants: patch.grants ?? [],
                  },
                ],
          };
        if (
          sql.startsWith(
            "SELECT id FROM public.clinics WHERE account_id=$1 AND",
          )
        )
          return { rows: patch.unapproved ? [] : [{ id }] };
        if (sql.startsWith("SELECT id,current_version_id"))
          return {
            rows: patch.foreign
              ? []
              : [{ id, current_version_id: draft.version }],
          };
        if (
          sql.startsWith("SELECT id,clinic_id,status") ||
          sql.startsWith("SELECT id,number::text")
        )
          return {
            rows: patch.foreign
              ? []
              : [
                  {
                    id,
                    number: "1",
                    clinic_id: id,
                    kind: patch.kind ?? "normal",
                    origin: patch.origin ?? "clinic",
                    status: draft.status,
                    current_version_id: patch.changed ? other : draft.version,
                    manufacturing_version_id: patch.pinned ? id : null,
                    revision: String(draft.revision),
                  },
                ],
          };
        if (sql.startsWith("SELECT v.id,v.material_snapshot_id"))
          return {
            rows: [
              {
                id: values[1],
                material_snapshot_id: id,
                shade_snapshot_id: shade,
                work_type_snapshot_id: patch.deletedType ? other : null,
                material_id: id,
                shade_id: shade,
                work_type_id: null,
                material: "Historical material",
                shade: "Historical shade",
                work_type: patch.deletedType ? "Historical type" : null,
                patient: input.patient,
                requested_delivery_date: input.requested_delivery_date,
                description: input.description,
                teeth: patch.kind === "retouch" ? [] : input.teeth,
                file_count: patch.files ? 1 : 0,
              },
            ],
          };
        if (sql.startsWith("SELECT id,kind,label"))
          return {
            rows: [
              {
                id,
                kind: "material",
                label: "Renamed material",
                revision: "2",
                state: patch.catalogState ?? "available",
              },
              {
                id: shade,
                kind: "shade",
                label: "Shade",
                revision: "1",
                state: "available",
              },
            ],
          };
        if (sql.includes("FROM public.order_requests"))
          return { rows: patch.pending ? [{ id }] : [] };
        if (sql.includes("FROM public.order_security_blocks"))
          return { rows: patch.block ? [{ id }] : [] };
        if (sql.startsWith("SELECT COALESCE(max"))
          return { rows: [{ latest: "4" }] };
        if (sql.startsWith("SELECT id,version_number"))
          return {
            rows: [
              {
                id,
                version_number: "1",
                created_at: new Date("2026-10-17T00:00:00Z"),
                created_by: id,
                reason: null,
              },
            ],
          };
        if (/^(INSERT|UPDATE)/.test(sql)) {
          if (patch.failAt && sql.includes(patch.failAt))
            throw new Error("SYNTHETIC_FAILURE");
          draft.writes.push([sql, values]);
          if (sql.startsWith("UPDATE public.orders")) {
            draft.version = values[1];
            draft.status = values[2];
            draft.revision++;
            return { rows: patch.updateConflict ? [] : [{ id }] };
          }
        }
        return { rows: [] };
      };
      const result = await fn({ query });
      Object.assign(state, draft);
      return result;
    });
    queue = task.catch(() => {});
    return task;
  });
  return { state, calls, transaction };
}
test("save appends version and teeth, preserves prior snapshots and status, uses max version including proposals", async () => {
  const db = fixture();
  const r = await createOrderEditService(db).decide(actor, command);
  expect(r.result.kind).toBe("updated");
  expect(r.result.status).toBe("pending");
  expect(r.result.version_id).not.toBe(id);
  const version = db.state.writes.find(([s]) =>
    s.startsWith("INSERT INTO public.order_versions"),
  )[1];
  expect(version[5]).toBe(5);
  expect(version.slice(11, 14)).toEqual([id, shade, null]);
  expect(
    db.state.writes.some(([s]) =>
      s.includes("INSERT INTO public.catalog_reference_snapshots"),
    ),
  ).toBe(false);
  expect(
    db.state.writes.some(
      ([s]) =>
        s.startsWith("UPDATE public.order_versions") || s.startsWith("DELETE"),
    ),
  ).toBe(false);
  expect(
    db.calls.findIndex(([s]) => s.includes("ORDER BY id FOR SHARE")),
  ).toBeLessThan(
    db.calls.findIndex(
      ([s]) => s.includes("FROM public.orders") && s.endsWith("FOR UPDATE"),
    ),
  );
});
test("permission scope and current clinic approval checked before reading patient version", async () => {
  for (const patch of [
    { foreign: true },
    { revoked: true },
    { unapproved: true },
    { suspended: true },
    { profile: "employee" },
    { profile: "owner", ownerCurrent: false },
  ]) {
    const db = fixture(patch);
    expect((await createOrderEditService(db).decide(actor, command)).kind).toBe(
      "denied",
    );
    expect(db.state.writes).toEqual([]);
    expect(db.calls.some(([s]) => s.startsWith("SELECT v.id,"))).toBe(false);
  }
});
test("clinic edits pending/correction only; lab edits accepted with explicit permission reason and no pending", async () => {
  for (const status of [
    "accepted",
    "manufacturing",
    "completed",
    "delivered",
    "cancelled",
    "rejected",
  ]) {
    const db = fixture({ status });
    expect(
      (await createOrderEditService(db).decide(actor, command)).result.kind,
    ).toBe("conflict");
    expect(db.state.writes).toEqual([]);
  }
  const db = fixture({
      status: "accepted",
      profile: "employee",
      grants: [
        "orders.read_logistics",
        "orders.read_details",
        "orders.edit_instructions",
      ],
    }),
    service = createOrderEditService(db);
  expect((await service.decide(actor, command)).kind).toBe("invalid");
  expect(
    (
      await service.decide(actor, {
        ...command,
        reason: "Synthetic laboratory edit",
      })
    ).result.status,
  ).toBe("accepted");
  expect(
    db.state.writes.find(([s]) =>
      s.includes("INSERT INTO public.order_versions"),
    )[1][7],
  ).toBe("Synthetic laboratory edit");
});
test("stale versions revisions manufacturing pin and pending requests fail closed", async () => {
  for (const [patch, cmd] of [
    [{ changed: true }, command],
    [{ pinned: true }, command],
    [{}, { ...command, expected_revision: 2 }],
    [{}, { ...command, expected_version_id: other }],
  ]) {
    const db = fixture(patch);
    expect(
      (await createOrderEditService(db).decide(actor, cmd)).result.kind,
    ).toBe("conflict");
    expect(db.state.writes).toEqual([]);
  }
  const db = fixture({ pending: true });
  expect(
    (await createOrderEditService(db).decide(actor, command)).result,
  ).toEqual({ kind: "blocked", reason: "pending_request" });
  expect(db.state.writes).toEqual([]);
});
test("saving correction retains correction status; explicit resubmission uses current version and needs new lab decision", async () => {
  const db = fixture({ status: "correction_requested" }),
    service = createOrderEditService(db);
  const saved = (await service.decide(actor, command)).result;
  expect(saved.status).toBe("correction_requested");
  expect(db.state.writes.some(([s]) => s.includes("order_status_events"))).toBe(
    false,
  );
  const r = await service.decide(actor, {
    action: "resubmit_correction",
    order_id: id,
    expected_version_id: saved.version_id,
    expected_revision: 2,
    confirmed_warnings: false,
  });
  expect(r.result.status).toBe("pending");
  expect(r.result.version_id).toBe(saved.version_id);
  expect(
    db.state.writes.filter(([s]) =>
      s.includes("INSERT INTO public.order_versions"),
    ),
  ).toHaveLength(1);
  expect(
    db.state.writes.some(
      ([s, v]) =>
        s.includes("outbox_events") && v[1] === "correction_resubmitted",
    ),
  ).toBe(true);
});
test("files never silently dropped; missing optional reference not silently removed on resubmit; unavailable needs acknowledgement", async () => {
  for (const patch of [{ files: true }, { catalogState: "forbidden" }]) {
    const db = fixture(patch);
    expect(
      (await createOrderEditService(db).decide(actor, command)).result.kind,
    ).toBe("blocked");
    expect(db.state.writes).toEqual([]);
  }
  const db = fixture({ catalogState: "unavailable" });
  expect(
    (await createOrderEditService(db).decide(actor, command)).result.kind,
  ).toBe("confirmation_required");
  expect(
    (
      await createOrderEditService(db).decide(actor, {
        ...command,
        confirmed_warnings: true,
      })
    ).result.kind,
  ).toBe("updated");
  const missing = fixture({
    status: "correction_requested",
    deletedType: true,
  });
  expect(
    (
      await createOrderEditService(missing).decide(actor, {
        action: "resubmit_correction",
        order_id: id,
        expected_version_id: id,
        expected_revision: 1,
        confirmed_warnings: true,
      })
    ).result,
  ).toEqual({ kind: "blocked", reason: "catalog_missing" });
});
test("retouch requires problem description and forbids teeth; clinical normal date is mandatory", async () => {
  for (const [patch, change] of [
    [{ kind: "retouch" }, {}],
    [{ kind: "retouch" }, { teeth: [], description: " " }],
    [{}, { requested_delivery_date: null }],
  ]) {
    const db = fixture(patch);
    expect(
      (
        await createOrderEditService(db).decide(actor, {
          ...command,
          input: { ...input, ...change },
        })
      ).kind,
    ).toBe("invalid");
    expect(db.state.writes).toEqual([]);
  }
});
test("atomic double rolls back version teeth aggregate outbox audit failure; concurrent saves have one winner", async () => {
  for (const failAt of [
    "public.order_versions",
    "public.order_version_teeth",
    "UPDATE public.orders",
    "public.outbox_events",
    "public.outbox_dispatches",
    "public.audit_events",
  ]) {
    const db = fixture({ failAt });
    await expect(
      createOrderEditService(db).decide(actor, command),
    ).rejects.toThrow("SYNTHETIC_FAILURE");
    expect(db.state.writes).toEqual([]);
    expect(db.state.version).toBe(id);
  }
  const db = fixture(),
    service = createOrderEditService(db);
  expect(
    (
      await Promise.all([
        service.decide(actor, command),
        service.decide(actor, command),
      ])
    ).map((r) => r.result.kind),
  ).toEqual(["updated", "conflict"]);
});
test("history scoped to order and snapshot labels preserved; client does not retry malformed success", async () => {
  const db = fixture();
  const r = await createOrderEditService(db).context(actor, {
    order_id: id,
    version_id: other,
  });
  expect(r.result.version_id).toBe(other);
  expect(r.result.current_version_id).toBe(id);
  expect(r.result.labels.material).toBe("Historical material");
  expect(db.calls.find(([s]) => s.startsWith("SELECT v.id,"))[1]).toEqual([
    id,
    other,
  ]);
  const { createOrderEditClient } =
    await import("../../apps/web/src/features/orders/edit-api.ts");
  const fetcher = vi.fn(
    async () => new globalThis.Response("{}", { status: 200 }),
  );
  await expect(
    createOrderEditClient(fetcher).decide(
      command,
      new globalThis.AbortController().signal,
    ),
  ).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("clinical accepted proposal appends a separate version without changing official instructions; pending and stale submissions fail", async () => {
  const { createOrderModificationService } =
    await import("../../apps/api/dist/modules/orders/index.js");
  const proposed = { ...command, action: "propose_modification" };
  const db = fixture({ status: "accepted" });
  const r = await createOrderModificationService(db).propose(actor, proposed);
  expect(r.result.kind).toBe("updated");
  expect(db.state.version).toBe(id);
  expect(db.state.status).toBe("accepted");
  const version = db.state.writes.find(([s]) =>
    s.startsWith("INSERT INTO public.order_versions"),
  )[1][0];
  const req = db.state.writes.find(([s]) =>
    s.startsWith("INSERT INTO public.order_requests"),
  )[1];
  expect(req[3]).toBe(id);
  expect(req[4]).toBe(version);
  expect(version).not.toBe(id);
  expect(
    db.state.writes.find(([s]) =>
      s.startsWith("INSERT INTO public.outbox_events"),
    )[1][1],
  ).toBe("modification_requested");
  expect(
    (await createOrderModificationService(db).propose(actor, proposed)).result
      .kind,
  ).toBe("conflict");
  for (const patch of [
    { status: "pending" },
    { status: "accepted", pending: true },
    { status: "accepted", profile: "owner" },
  ]) {
    const blocked = fixture(patch);
    await createOrderModificationService(blocked).propose(actor, proposed);
    expect(blocked.state.writes).toEqual([]);
  }
  const concurrent = fixture({ status: "accepted" }),
    repo = createOrderModificationService(concurrent);
  const pair = await Promise.all([
    repo.propose(actor, proposed),
    repo.propose(actor, proposed),
  ]);
  expect(pair.map((r) => r.result.kind).sort()).toEqual([
    "conflict",
    "updated",
  ]);
  const failing = fixture({
    status: "accepted",
    failAt: "INSERT INTO public.order_requests",
  });
  await expect(
    createOrderModificationService(failing).propose(actor, proposed),
  ).rejects.toThrow("SYNTHETIC_FAILURE");
  expect(failing.state.writes).toEqual([]);
});
