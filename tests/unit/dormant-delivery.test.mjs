import { expect, test, vi } from "vitest";
import { createDormantDeliveryRepository } from "../../apps/api/dist/modules/notifications/dormant-delivery.repository.js";
import { runOneSyntheticDelivery } from "../../apps/api/dist/modules/notifications/dormant-delivery.worker.js";

const lease = { id: "delivery", lease_id: "lease", attempt_count: 1 };
function script(rows) {
  const calls = [];
  const database = {
    async transaction(fn) {
      return fn({
        async query(sql, values) {
          calls.push({ sql, values });
          if (!rows.length) throw new Error("UNEXPECTED_SQL");
          const next = rows.shift();
          if (next instanceof Error) throw next;
          return { rows: next };
        },
      });
    },
  };
  return {
    queue: createDormantDeliveryRepository(database),
    calls,
    remaining: rows,
  };
}

test("concurrent reservation relies on SKIP LOCKED and a conditional update", async () => {
  const db = script([[lease], [lease]]);
  expect(await db.queue.claim()).toEqual(lease);
  expect(db.calls[0].sql).toMatch(/FOR UPDATE SKIP LOCKED/);
  expect(db.calls[1].sql).toMatch(/lease_id IS NULL/);
  expect(db.calls[1].sql).toMatch(/attempt_count=attempt_count\+1/);
  expect(db.calls[1].values[0]).toBe(lease.id);
  expect(db.calls[1].values[1]).toMatch(/^[0-9a-f-]{36}$/);
  expect(db.remaining).toHaveLength(0);
  expect(await script([[]]).queue.claim()).toBeNull();
});

test("expired lease is marked ambiguous without reclaiming or contacting provider", async () => {
  const db = script([[lease], [], []]);
  expect(await db.queue.recoverExpired()).toBe(true);
  expect(db.calls[0].sql).toMatch(
    /lease_until<=clock_timestamp\(\).*FOR UPDATE SKIP LOCKED/s,
  );
  expect(db.calls[1].sql).toMatch(/'ambiguous','LEASE_EXPIRED'/);
  expect(db.calls[2].sql).toMatch(/state='failed'/);
  const provider = vi.fn();
  const runner = script([[lease], [], []]);
  expect(await runOneSyntheticDelivery(runner.queue, provider)).toBe(
    "recovered_ambiguous",
  );
  expect(provider).not.toHaveBeenCalled();
});

test("preflight checks event revision, status, clinic, account, grants and category", async () => {
  const row = {
    ...lease,
    event_id: "event",
    target_account_id: "target",
    type: "order_submitted",
  };
  const db = script([[row], [{ id: "order" }]]);
  expect(await db.queue.preflight(lease)).toBe("eligible");
  expect(db.calls[0].sql).toMatch(/FOR UPDATE OF d/);
  const sql = db.calls[1].sql;
  for (const term of [
    "o.revision=e.aggregate_revision",
    "o.status='pending'",
    "c.review_state='approved'",
    "NOT c.suspended",
    "a.lifecycle='active'",
    "sender.lifecycle='active'",
    "email_category_recipients",
    "orders.read_details",
    "orders.read_logistics",
    "owner_slot",
    "e.actor_id=c.account_id",
    "FOR SHARE OF o,c,sender,a",
  ])
    expect(sql).toContain(term);
  expect(sql).not.toMatch(/email_original|patient_reference|message_text/);
  expect(db.calls[1].values).toEqual([
    "event",
    "target",
    "laboratory",
    "order_submitted",
  ]);
  const revoked = script([[row], [], []]);
  expect(await revoked.queue.preflight(lease)).toBe("cancelled");
  expect(revoked.calls[2].values[2]).toBe("RECIPIENT_OR_EVENT_OBSOLETE");
  expect(await script([[]]).queue.preflight(lease)).toBe("lost");
});

test("settlement writes one attempt and handles accepted, temporary, permanent and ambiguous", async () => {
  const accepted = script([[lease], [], []]);
  expect(
    await accepted.queue.settle(lease, "provider_accepted", "fake:1"),
  ).toBe(true);
  expect(accepted.calls[1].values).toEqual([
    "delivery",
    1,
    "provider_accepted",
    null,
  ]);
  expect(accepted.calls[2].sql).toContain("provider_id=$2");
  for (const [outcome, state, delay] of [
    ["temporary_error", "pending", 30],
    ["permanent_error", "failed", 0],
    ["ambiguous", "failed", 0],
  ]) {
    const db = script([[lease], [], []]);
    expect(await db.queue.settle(lease, outcome)).toBe(true);
    expect(db.calls[1].values).toEqual([
      "delivery",
      1,
      outcome,
      outcome.toUpperCase(),
    ]);
    expect(db.calls[2].values).toEqual(["delivery", state, delay]);
  }
  expect(await script([[]]).queue.settle(lease, "ambiguous")).toBe(false);
  await expect(
    script([]).queue.settle(lease, "provider_accepted", "unsafe\n"),
  ).rejects.toThrow();
});

test("synthetic worker handles success, errors, timeout and revalidation failure", async () => {
  for (const [reply, expected] of [
    [
      { outcome: "provider_accepted", providerId: "fake:2" },
      "provider_accepted",
    ],
    [{ outcome: "temporary_error" }, "temporary_error"],
    [{ outcome: "permanent_error" }, "permanent_error"],
    [{ outcome: "ambiguous" }, "ambiguous"],
  ]) {
    const provider = vi.fn(async () => reply);
    const settled = vi.fn(async () => true);
    const queue = {
      recoverExpired: async () => false,
      claim: async () => lease,
      preflight: async () => "eligible",
      authorize: async () => "eligible",
      settle: settled,
    };
    expect(await runOneSyntheticDelivery(queue, provider)).toBe(expected);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(settled).toHaveBeenCalledWith(
      lease,
      reply.outcome,
      reply.providerId,
    );
  }
  const provider = vi.fn(async () => {
    throw new Error("timeout with unknown acceptance");
  });
  const settled = vi.fn(async () => true);
  const queue = {
    recoverExpired: async () => false,
    claim: async () => lease,
    preflight: async () => "eligible",
    authorize: async () => "eligible",
    settle: settled,
  };
  expect(await runOneSyntheticDelivery(queue, provider)).toBe("ambiguous");
  expect(settled).toHaveBeenCalledWith(lease, "ambiguous", undefined);
  queue.preflight = async () => "cancelled";
  expect(await runOneSyntheticDelivery(queue, provider)).toBe("cancelled");
  expect(provider).toHaveBeenCalledTimes(1);
});

test("failed preflight or attempt persistence does not report a delivered message", async () => {
  const provider = vi.fn(async () => ({
    outcome: "provider_accepted",
    providerId: "fake:3",
  }));
  const queue = {
    recoverExpired: async () => false,
    claim: async () => lease,
    preflight: async () => {
      throw new Error("SQL_ROLLBACK");
    },
    authorize: async () => "eligible",
    settle: vi.fn(),
  };
  await expect(runOneSyntheticDelivery(queue, provider)).rejects.toThrow(
    "SQL_ROLLBACK",
  );
  expect(provider).not.toHaveBeenCalled();
  queue.preflight = async () => "eligible";
  queue.settle = vi.fn(async () => {
    throw new Error("ATTEMPT_ROLLBACK");
  });
  await expect(runOneSyntheticDelivery(queue, provider)).rejects.toThrow(
    "ATTEMPT_ROLLBACK",
  );
  expect(provider).toHaveBeenCalledTimes(1);
  // A later run must first recover the expired lease as ambiguous.
  const recovery = vi.fn(async () => true);
  queue.recoverExpired = recovery;
  expect(await runOneSyntheticDelivery(queue, provider)).toBe(
    "recovered_ambiguous",
  );
  expect(provider).toHaveBeenCalledTimes(1);
});

test("two synthetic workers compete for one claim without duplicate provider calls", async () => {
  let available = true;
  const claim = vi.fn(async () => {
    if (!available) return null;
    available = false;
    return lease;
  });
  const provider = vi.fn(async () => ({
    outcome: "provider_accepted",
    providerId: "fake:4",
  }));
  const queue = {
    recoverExpired: async () => false,
    claim,
    preflight: async () => "eligible",
    authorize: async () => "eligible",
    settle: async () => true,
  };
  expect(
    await Promise.all([
      runOneSyntheticDelivery(queue, provider),
      runOneSyntheticDelivery(queue, provider),
    ]),
  ).toEqual(["provider_accepted", "idle"]);
  expect(provider).toHaveBeenCalledTimes(1);
  // This double is not evidence of PostgreSQL row locking.
});

test("an actual synthetic deadline settles as ambiguous; invalid deadlines fail closed", async () => {
  const provider = vi.fn(() => new Promise(() => {}));
  const settle = vi.fn(async () => true);
  const queue = {
    recoverExpired: async () => false,
    claim: async () => lease,
    preflight: async () => "eligible",
    authorize: async () => "eligible",
    settle,
  };
  expect(await runOneSyntheticDelivery(queue, provider, 5)).toBe("ambiguous");
  expect(settle).toHaveBeenCalledWith(lease, "ambiguous", undefined);
  await expect(runOneSyntheticDelivery(queue, provider, 0)).rejects.toThrow(
    "SYNTHETIC_TIMEOUT_INVALID",
  );
  expect(provider).toHaveBeenCalledTimes(1);
});

test("revocation between preliminary preflight and final authorization blocks handoff", async () => {
  const provider = vi.fn(async () => ({
    outcome: "provider_accepted",
    providerId: "fake",
  }));
  let permitted = true;
  const queue = {
    recoverExpired: async () => false,
    claim: async () => lease,
    preflight: async () => {
      permitted = false;
      return "eligible";
    },
    authorize: vi.fn(async () => (permitted ? "eligible" : "cancelled")),
    settle: vi.fn(),
  };
  expect(await runOneSyntheticDelivery(queue, provider)).toBe("cancelled");
  expect(queue.authorize).toHaveBeenCalledWith(lease);
  expect(provider).not.toHaveBeenCalled();
  expect(queue.settle).not.toHaveBeenCalled();
});

test("revocation after final authorization exposes the unavoidable external gap", async () => {
  let permitted = true;
  const provider = vi.fn(async () => {
    permitted = false;
    throw new Error("transport acceptance unknown");
  });
  const settle = vi.fn(async () => true);
  const queue = {
    recoverExpired: async () => false,
    claim: async () => lease,
    preflight: async () => "eligible",
    authorize: async () => (permitted ? "eligible" : "cancelled"),
    settle,
  };
  expect(await runOneSyntheticDelivery(queue, provider)).toBe("ambiguous");
  expect(permitted).toBe(false);
  expect(settle).toHaveBeenCalledWith(lease, "ambiguous", undefined);
});
