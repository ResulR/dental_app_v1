import { expect, test } from "vitest";
import { exitMaintenance } from "../../scripts/maintenance-emergency-exit.mjs";

const origin = "https://example.test";
const token = "a".repeat(43);
function fixture({ active = true, revision = 4, lost = false } = {}) {
  const calls = [];
  const state = {
    active,
    revision,
    message: "Pauzë",
    planned_at: null,
    planned_message: "",
  };
  const request = async (url, options) => {
    calls.push({
      path: url.pathname,
      method: options.method ?? "GET",
      headers: options.headers,
    });
    if (options.method === "PUT") {
      const body = JSON.parse(options.body);
      if (body.expected_revision !== state.revision)
        return { ok: false, status: 409 };
      state.active = body.active;
      state.revision++;
      if (lost) throw new Error("network");
      return { ok: true, json: async () => ({ kind: "applied" }) };
    }
    return { ok: true, json: async () => ({ ...state }) };
  };
  return { request, state, calls };
}
test("owner emergency exit uses revision, checks durable result and never retries", async () => {
  const fixture1 = fixture();
  expect(
    await exitMaintenance({
      origin,
      token,
      expectedRevision: 4,
      request: fixture1.request,
    }),
  ).toEqual({ kind: "confirmed", revision: 5 });
  expect(fixture1.calls.map(({ method }) => method)).toEqual([
    "GET",
    "PUT",
    "GET",
  ]);
  expect(fixture1.calls[1].headers.cookie).toBe(
    "__Host-dental_session=" + token,
  );
  const fixture2 = fixture({ lost: true });
  expect(
    await exitMaintenance({
      origin,
      token,
      expectedRevision: 4,
      request: fixture2.request,
    }),
  ).toEqual({ kind: "uncertain_inactive", revision: 5 });
  expect(fixture2.calls.filter(({ method }) => method === "PUT")).toHaveLength(
    1,
  );
});
test("stale revision and inactive state cannot create another event", async () => {
  const f = fixture();
  await expect(
    exitMaintenance({ origin, token, expectedRevision: 3, request: f.request }),
  ).rejects.toThrow("REVISION_CONFLICT");
  expect(f.calls).toHaveLength(1);
  const inactive = fixture({ active: false });
  expect(
    await exitMaintenance({
      origin,
      token,
      expectedRevision: 4,
      request: inactive.request,
    }),
  ).toEqual({ kind: "already_inactive", revision: 4 });
  expect(inactive.calls).toHaveLength(1);
});
test("reject non-TLS origin, invalid credential and ambiguous active response", async () => {
  const f = fixture({ lost: true });
  await expect(
    exitMaintenance({
      origin: "http://example.test",
      token,
      expectedRevision: 4,
      request: f.request,
    }),
  ).rejects.toThrow("INVALID_ORIGIN");
  await expect(
    exitMaintenance({
      origin,
      token: "bad",
      expectedRevision: 4,
      request: f.request,
    }),
  ).rejects.toThrow("INVALID_INPUT");
  const request = async (_url, options) =>
    options.method === "PUT"
      ? Promise.reject(new Error("network"))
      : {
          ok: true,
          json: async () => ({
            active: true,
            revision: 4,
            message: "Pauzë",
            planned_at: null,
            planned_message: "",
          }),
        };
  expect(
    await exitMaintenance({ origin, token, expectedRevision: 4, request }),
  ).toEqual({ kind: "uncertain_active", revision: 4 });
});
