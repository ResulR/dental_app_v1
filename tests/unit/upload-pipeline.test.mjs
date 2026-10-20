import { test, expect } from "vitest";
import { createHash } from "node:crypto";
import { createUploadPipeline } from "../../apps/api/dist/modules/files/index.js";
const actor = { accountId: "account", sessionId: "session" };
const signal = () => new globalThis.AbortController().signal;
async function* chunks(...values) {
  for (const v of values) yield Uint8Array.from(v);
}
function fixture(overrides = {}) {
  const calls = [],
    stored = [];
  const evidence = () => ({
    sizeBytes: stored.reduce((n, b) => n + b.length, 0),
    sha256: createHash("sha256").update(Buffer.concat(stored)).digest("hex"),
  });
  const ports = {
    claim: async () => {
      calls.push("claim");
      return { kind: "claimed", lease: { token: "lease", sizeBytes: 3 } };
    },
    open: async () => {
      calls.push("open");
      return {
        write: async (b) => {
          calls.push("write");
          stored.push(Buffer.from(b));
        },
        seal: async () => {
          calls.push("seal");
          return evidence();
        },
      };
    },
    inspect: async () => {
      calls.push("inspect");
      return {
        ...evidence(),
        verdict: "clean",
        format: "stl",
        mediaType: "model/stl",
        scannerVersion: "fake-scanner",
        validatorVersion: "fake-validator",
      };
    },
    ready: async () => {
      calls.push("ready");
      return "ready";
    },
    recover: async (_, outcome) => {
      calls.push(outcome);
    },
    ...overrides,
  };
  return {
    ports,
    calls,
    stored,
    pipeline: createUploadPipeline({ maxChunkBytes: 3 }, ports),
  };
}
test("streams with backpressure, seals and verifies before ready, never returns attached", async () => {
  const f = fixture();
  expect(
    await f.pipeline.receive(actor, "upload", chunks([1], [2, 3]), signal()),
  ).toEqual({ kind: "ready" });
  expect(f.calls).toEqual([
    "claim",
    "open",
    "write",
    "write",
    "seal",
    "inspect",
    "ready",
  ]);
});
test("missing dependencies rejected; admission refusal never consumes bytes or opens storage", async () => {
  expect(() => createUploadPipeline({ maxChunkBytes: 3 }, {})).toThrow(
    "dependencies_required",
  );
  for (const kind of ["denied", "busy", "capacity", "unavailable"]) {
    let consumed = false;
    async function* source() {
      consumed = true;
      yield new Uint8Array([1]);
    }
    const f = fixture({ claim: async () => ({ kind }) });
    expect(
      await f.pipeline.receive(actor, "upload", source(), signal()),
    ).toEqual({ kind });
    expect(consumed).toBe(false);
    expect(f.calls).toEqual([]);
  }
});
test("oversize, truncated, empty and interrupted streams recover without publication", async () => {
  async function* broken() {
    yield new Uint8Array([1]);
    throw new Error("socket");
  }
  for (const source of [
    chunks([1, 2, 3, 4]),
    chunks([1]),
    chunks([]),
    broken(),
  ]) {
    const f = fixture();
    await expect(
      f.pipeline.receive(actor, "upload", source, signal()),
    ).rejects.toThrow("upload_failed");
    expect(f.calls.at(-1)).toBe("rejected");
    expect(f.calls).not.toContain("inspect");
    expect(f.calls).not.toContain("ready");
  }
});
test("source cancellation closes iterator and requests lease-scoped recovery", async () => {
  const c = new globalThis.AbortController();
  let closed = false;
  async function* source() {
    try {
      yield new Uint8Array([1]);
      c.abort();
      yield new Uint8Array([2, 3]);
    } finally {
      closed = true;
    }
  }
  const f = fixture();
  await expect(
    f.pipeline.receive(actor, "upload", source(), c.signal),
  ).rejects.toThrow("upload_failed");
  expect(closed).toBe(true);
  expect(f.calls.at(-1)).toBe("rejected");
  expect(f.calls).not.toContain("ready");
});
test("invalid content, missing attestation, disallowed format or altered sealed bytes fail closed", async () => {
  for (const patch of [
    { verdict: "rejected" },
    { format: "exe" },
    { scannerVersion: "" },
    { validatorVersion: "" },
    { sha256: "0".repeat(64) },
    { sizeBytes: 2 },
    { mediaType: "model/stl\r\nInjected: 1" },
  ]) {
    const f = fixture();
    const original = f.ports.inspect;
    f.ports.inspect = async (...args) => ({
      ...(await original(...args)),
      ...patch,
    });
    await expect(
      f.pipeline.receive(actor, "upload", chunks([1, 2, 3]), signal()),
    ).rejects.toThrow("verification_failed");
    expect(f.calls).not.toContain("ready");
    expect(f.calls.at(-1)).toBe("rejected");
  }
  const f = fixture({
    open: async () => ({
      write: async () => {},
      seal: async () => ({ sizeBytes: 3, sha256: "0".repeat(64) }),
    }),
  });
  await expect(
    f.pipeline.receive(actor, "upload", chunks([1, 2, 3]), signal()),
  ).rejects.toThrow("verification_failed");
  expect(f.calls).not.toContain("inspect");
});
test("publication denial/conflict recovers; lost commit response preserves uncertain object", async () => {
  for (const kind of ["denied", "conflict"]) {
    const f = fixture({ ready: async () => kind });
    expect(
      await f.pipeline.receive(actor, "upload", chunks([1, 2, 3]), signal()),
    ).toEqual({ kind });
    expect(f.calls.at(-1)).toBe("rejected");
  }
  for (const ready of [
    async () => {
      throw new Error("lost commit response");
    },
    async () => "invalid",
  ]) {
    const f = fixture({ ready });
    await expect(
      f.pipeline.receive(actor, "upload", chunks([1, 2, 3]), signal()),
    ).rejects.toThrow("upload_failed");
    expect(f.calls.at(-1)).toBe("uncertain");
  }
});
test("recovery failure is explicit and not retried as a destructive cleanup", async () => {
  let recoveries = 0;
  const f = fixture({
    ready: async () => "denied",
    recover: async () => {
      recoveries++;
      throw new Error("disk");
    },
  });
  await expect(
    f.pipeline.receive(actor, "upload", chunks([1, 2, 3]), signal()),
  ).rejects.toThrow("reconciliation_required");
  expect(recoveries).toBe(1);
});
test("exclusive claim adapter rejects simultaneous duplicate; no process-local lock pretends to prove SQL", async () => {
  let claimed = false,
    release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const f = fixture({
    claim: async () => {
      if (claimed) return { kind: "busy" };
      claimed = true;
      return { kind: "claimed", lease: { token: "lease", sizeBytes: 3 } };
    },
    ready: async () => {
      await gate;
      return "ready";
    },
  });
  const first = f.pipeline.receive(
    actor,
    "upload",
    chunks([1, 2, 3]),
    signal(),
  );
  expect(
    await f.pipeline.receive(actor, "upload", chunks([4, 5, 6]), signal()),
  ).toEqual({ kind: "busy" });
  release();
  expect(await first).toEqual({ kind: "ready" });
  expect(f.calls.filter((c) => c === "open")).toHaveLength(1);
});

test("explicit chunk memory budget checked before copying/writing; no default operational policy", async () => {
  const f = fixture();
  expect(() => createUploadPipeline({ maxChunkBytes: 0 }, f.ports)).toThrow(
    "invalid_size",
  );
  const pipeline = createUploadPipeline({ maxChunkBytes: 2 }, f.ports);
  await expect(
    pipeline.receive(actor, "upload", chunks([1, 2, 3]), signal()),
  ).rejects.toThrow("upload_failed");
  expect(f.calls).not.toContain("write");
  expect(f.calls.at(-1)).toBe("rejected");
});
