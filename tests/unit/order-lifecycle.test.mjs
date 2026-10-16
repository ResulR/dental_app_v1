import { test, expect, vi } from "vitest";
import {
  createOrderLifecycleService,
  assertOrderLifecycleReady,
} from "../../apps/api/dist/modules/orders/index.js";
import { orderLifecycleEnabled } from "../../apps/api/dist/app/order-lifecycle-config.js";
const id = "91000000-0000-4000-8000-000000000001",
  other = "91000000-0000-4000-8000-000000000002",
  actor = { accountId: id, sessionId: id };
const command = {
  order_id: id,
  expected_version_id: id,
  expected_revision: 1,
  action: "complete",
};
function fixture(patch = {}) {
  const state = {
      status: patch.status ?? "manufacturing",
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
                    profile: patch.profile ?? "owner",
                    lifecycle: "active",
                    sessionValid: true,
                    securityLocked: false,
                    resetRequired: false,
                    ownerCurrent: patch.ownerCurrent ?? true,
                    clinicId: id,
                    clinicSuspended: false,
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
        if (sql.startsWith("SELECT id AS order_id"))
          return {
            rows: patch.foreign
              ? []
              : [
                  {
                    order_id: id,
                    number: "1",
                    status: draft.status,
                    version_id: id,
                    revision: String(draft.revision),
                  },
                ],
          };
        if (sql.includes("FROM public.work_links"))
          return { rows: patch.retouch ? [{ id }] : [] };
        if (sql.startsWith("SELECT to_jsonb(l)"))
          return {
            rows: patch.noLogistics
              ? []
              : [{ values: { delivery_mode: null } }],
          };
        if (sql.startsWith("SELECT o.current_version_id"))
          return {
            rows: [
              {
                current_version_id: id,
                material_snapshot_id: id,
                shade_snapshot_id: other,
                work_type_snapshot_id: null,
              },
            ],
          };
        if (sql.startsWith("SELECT id,reference_id"))
          return {
            rows: [
              { id, reference_id: patch.missing ? null : id },
              { id: other, reference_id: other },
            ],
          };
        if (sql.startsWith("SELECT id,clinic_id,status")) {
          if (patch.foreign) return { rows: [] };
          return {
            rows: [
              {
                id,
                clinic_id: id,
                status: draft.status,
                current_version_id: patch.changedVersion ? other : id,
                revision: String(draft.revision),
                manufacturing_version_id: patch.unpinned ? other : id,
              },
            ],
          };
        }
        if (sql.startsWith("SELECT id,effective_use_state"))
          return {
            rows: [
              { id, state: patch.catalogState ?? "available" },
              { id: other, state: "available" },
            ],
          };
        if (sql.includes("FROM public.order_security_blocks"))
          return { rows: patch.block ? [{ id }] : [] };
        if (sql.includes("FROM public.order_version_files"))
          return { rows: patch.files ? [{ file_id: id }] : [] };
        if (sql.includes("FROM public.order_requests"))
          return { rows: patch.pending ? [{ id }] : [] };
        if (/^(UPDATE|INSERT|WITH stamp)/.test(sql)) {
          if (patch.failAt && sql.includes(patch.failAt))
            throw new Error("SYNTHETIC_FAILURE");
          draft.writes.push([sql, values]);
          if (sql.startsWith("UPDATE public.order_requests"))
            return { rows: patch.pending ? [{ id }] : [] };
          if (sql.includes("UPDATE public.order_logistics"))
            return { rows: [{ values: { delivery_mode: "clinic_pickup" } }] };
          if (sql.startsWith("UPDATE public.conversations"))
            return { rows: patch.noConversation ? [] : [{ id }] };
          if (sql.startsWith("UPDATE public.orders")) {
            if (patch.activeRetouch)
              throw Object.assign(new Error("Synthetic unique violation"), {
                code: "23505",
                constraint: "work_links_one_active_retouch_idx",
              });
            draft.status = values[1];
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
  return { transaction, state, calls };
}

test("completion pins historical instructions and commits status event outbox audit once", async () => {
  const db = fixture(),
    service = createOrderLifecycleService(db);
  expect((await service.decide(actor, command)).result.status).toBe(
    "completed",
  );
  expect(db.state.writes).toHaveLength(5);
  expect((await service.decide(actor, command)).result.kind).toBe("conflict");
  expect(db.state.writes).toHaveLength(5);
  expect(
    db.state.writes.some(([s]) =>
      /UPDATE public.(order_versions|catalog)/.test(s),
    ),
  ).toBe(false);
  expect(
    db.calls.findIndex(([s]) => s.includes("ORDER BY id FOR SHARE")),
  ).toBeLessThan(db.calls.findIndex(([s]) => s.includes("FOR UPDATE")));
});
test("all forbidden states stale versions and revisions refuse without writes", async () => {
  for (const status of [
    "pending",
    "accepted",
    "correction_requested",
    "completed",
    "delivered",
    "cancelled",
    "rejected",
  ]) {
    const db = fixture({ status });
    expect(
      (await createOrderLifecycleService(db).decide(actor, command)).result
        .kind,
    ).toBe("conflict");
    expect(db.state.writes).toEqual([]);
  }
  for (const patch of [
    { changedVersion: true },
    { revoked: true },
    { ownerCurrent: false },
    { profile: "employee", grants: ["orders.change_status"] },
  ]) {
    const db = fixture(patch);
    const r = await createOrderLifecycleService(db).decide(actor, command);
    expect(r.kind === "denied" || r.result?.kind === "conflict").toBe(true);
    expect(db.state.writes).toEqual([]);
  }
  const db = fixture();
  expect(
    (
      await createOrderLifecycleService(db).decide(actor, {
        ...command,
        expected_revision: 99,
      })
    ).result.kind,
  ).toBe("conflict");
  expect(db.state.writes).toEqual([]);
});
test("security catalogue files and pending requests fail closed for completion and delivery", async () => {
  for (const action of ["complete", "deliver"])
    for (const [patch, reason] of [
      [{ block: true }, "security_block"],
      [{ catalogState: "forbidden" }, "catalog_forbidden"],
      [{ missing: true }, "catalog_missing"],
      [{ pending: true }, "pending_request"],
      [{ files: true }, "files_not_ready"],
    ]) {
      const db = fixture({
        ...patch,
        status: action === "complete" ? "manufacturing" : "completed",
      });
      expect(
        (
          await createOrderLifecycleService(db).decide(actor, {
            ...command,
            action,
            ...(action === "deliver"
              ? { confirmed: true, mode: "clinic_pickup" }
              : {}),
          })
        ).result,
      ).toEqual({ kind: "blocked", reason });
      expect(db.state.writes).toEqual([]);
    }
  const db = fixture({ unpinned: true });
  await expect(
    createOrderLifecycleService(db).decide(actor, command),
  ).rejects.toThrow("MANUFACTURING_VERSION_INCONSISTENT");
  expect(db.state.writes).toEqual([]);
});
test("delivery requires confirmation records server time mode archive timer and closes conversation atomically", async () => {
  const cmd = {
    ...command,
    action: "deliver",
    confirmed: true,
    mode: "clinic_pickup",
  };
  const db = fixture({
      status: "completed",
      profile: "employee",
      grants: ["orders.read_logistics", "delivery.mark_delivered"],
    }),
    service = createOrderLifecycleService(db);
  expect((await service.decide(actor, { ...cmd, confirmed: false })).kind).toBe(
    "invalid",
  );
  expect((await service.decide(actor, cmd)).result.status).toBe("delivered");
  expect(
    db.state.writes.find(([s]) =>
      s.includes("UPDATE public.order_logistics"),
    )[0],
  ).toContain("interval '30 days'");
  expect(
    db.state.writes.find(([s]) =>
      s.startsWith("UPDATE public.conversations"),
    )[1],
  ).toEqual([id, true]);
  expect(
    db.state.writes.find(([s]) => s.includes("public.outbox_events"))[1][1],
  ).toBe("order_delivered");
  expect(
    db.state.writes.some(([s]) => s.includes("notification_deliveries")),
  ).toBe(false);
});
test("delivery correction restricted to authorized admins and owner, any retouch blocks, active sibling collision rolls back", async () => {
  const cmd = {
    ...command,
    action: "correct_delivery",
    reason: "Synthetic correction",
  };
  for (const profile of ["clinic", "employee", "admin"]) {
    const db = fixture({
      status: "delivered",
      profile,
      grants:
        profile === "employee"
          ? ["orders.read_logistics", "delivery.correct"]
          : [],
    });
    expect(
      (await createOrderLifecycleService(db).decide(actor, cmd)).kind,
    ).toBe("denied");
    expect(db.state.writes).toEqual([]);
  }
  const db = fixture({
    status: "delivered",
    profile: "admin",
    grants: ["orders.read_logistics", "delivery.correct"],
  });
  expect(
    (await createOrderLifecycleService(db).decide(actor, cmd)).result.status,
  ).toBe("completed");
  expect(
    db.state.writes.find(([s]) =>
      s.startsWith("UPDATE public.conversations"),
    )[1],
  ).toEqual([id, false]);
  expect(
    db.state.writes.find(([s]) =>
      s.includes("UPDATE public.order_logistics"),
    )[0],
  ).toContain("archive_due_at=NULL");
  for (const [patch, reason] of [
    [{ retouch: true }, "linked_retouch"],
    [{ activeRetouch: true }, "active_retouch"],
  ]) {
    const blocked = fixture({ status: "delivered", ...patch });
    expect(
      (await createOrderLifecycleService(blocked).decide(actor, cmd)).result,
    ).toEqual({ kind: "blocked", reason });
    expect(blocked.state.writes).toEqual([]);
  }
});
test("clinic direct cancellation only own pending/correction with confirmation; lab requires reason through manufacturing", async () => {
  for (const status of [
    "pending",
    "correction_requested",
    "accepted",
    "manufacturing",
    "completed",
    "delivered",
  ]) {
    const db = fixture({ status, profile: "clinic" });
    const r = await createOrderLifecycleService(db).decide(actor, {
      ...command,
      action: "cancel",
      confirmed: true,
    });
    expect(r.result.kind).toBe(
      ["pending", "correction_requested"].includes(status)
        ? "updated"
        : "conflict",
    );
  }
  for (const patch of [{ foreign: true }, { unapproved: true }]) {
    const db = fixture({ status: "pending", profile: "clinic", ...patch });
    expect(
      (
        await createOrderLifecycleService(db).decide(actor, {
          ...command,
          action: "cancel",
          confirmed: true,
        })
      ).kind,
    ).toBe("denied");
    expect(db.state.writes).toEqual([]);
  }
  const db = fixture({ status: "accepted", pending: true }),
    service = createOrderLifecycleService(db);
  expect(
    (
      await service.decide(actor, {
        ...command,
        action: "cancel",
        confirmed: true,
      })
    ).kind,
  ).toBe("invalid");
  expect(
    (
      await service.decide(actor, {
        ...command,
        action: "cancel",
        confirmed: true,
        reason: "Synthetic cancellation",
      })
    ).result.status,
  ).toBe("cancelled");
  expect(
    db.state.writes.some(([s]) => s.includes("close_cause='order_cancelled'")),
  ).toBe(true);
});
test("correction requested only pending with reason and permission, no silent resubmission", async () => {
  const db = fixture({ status: "pending" });
  expect(
    (
      await createOrderLifecycleService(db).decide(actor, {
        ...command,
        action: "request_correction",
        reason: "Synthetic correction",
      })
    ).result.status,
  ).toBe("correction_requested");
  expect(
    (
      await createOrderLifecycleService(db).decide(actor, {
        ...command,
        action: "request_correction",
        reason: " ",
      })
    ).kind,
  ).toBe("invalid");
});
test("transaction double rolls back all writes on event logistics conversation dispatch and audit failures", async () => {
  for (const failAt of [
    "UPDATE public.orders",
    "UPDATE public.order_logistics",
    "public.order_logistics_events",
    "UPDATE public.conversations",
    "public.order_status_events",
    "public.outbox_events",
    "public.outbox_dispatches",
    "public.audit_events",
  ]) {
    const db = fixture({ status: "completed", failAt });
    await expect(
      createOrderLifecycleService(db).decide(actor, {
        ...command,
        action: "deliver",
        confirmed: true,
        mode: "external_courier",
      }),
    ).rejects.toThrow("SYNTHETIC_FAILURE");
    expect(db.state.status).toBe("completed");
    expect(db.state.writes).toEqual([]);
    expect(db.transaction).toHaveBeenCalledTimes(1);
  }
  const db = fixture({ status: "completed", noConversation: true });
  await expect(
    createOrderLifecycleService(db).decide(actor, {
      ...command,
      action: "deliver",
      confirmed: true,
      mode: "external_courier",
    }),
  ).rejects.toThrow("ORDER_CONVERSATION_MISSING");
  expect(db.state.writes).toEqual([]);
});
test("concurrent attempts serialize in double with one winner, context has no patient and activation defaults off", async () => {
  const db = fixture(),
    service = createOrderLifecycleService(db);
  expect(
    (
      await Promise.all([
        service.decide(actor, command),
        service.decide(actor, command),
      ])
    ).map((r) => r.result.kind),
  ).toEqual(["updated", "conflict"]);
  const context = await service.context(actor, { order_id: id });
  expect(Object.keys(context.result).sort()).toEqual([
    "number",
    "order_id",
    "revision",
    "status",
    "version_id",
  ]);
  expect(orderLifecycleEnabled({})).toBe(false);
  expect(() =>
    orderLifecycleEnabled({ DENTAL_LAB_ORDER_LIFECYCLE_ENABLED: "true" }),
  ).toThrow();
  await expect(
    assertOrderLifecycleReady({
      query: async () => ({ rows: [{ ready: false }] }),
    }),
  ).rejects.toThrow();
});

test("client rejects unknown outcomes and never retries a mutation automatically", async () => {
  const { createOrderLifecycleClient } =
    await import("../../apps/web/src/features/orders/lifecycle-api.ts");
  const fetcher = vi.fn(
    async () => new globalThis.Response("{}", { status: 200 }),
  );
  await expect(
    createOrderLifecycleClient(fetcher).decide(
      command,
      new globalThis.AbortController().signal,
    ),
  ).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    method: "POST",
    cache: "no-store",
    redirect: "error",
    credentials: "same-origin",
  });
});
