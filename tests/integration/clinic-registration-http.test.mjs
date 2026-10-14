import { expect, test, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import {
  createClinicRegistrationService,
  registerClinicRegistrationRoutes,
} from "../../apps/api/dist/modules/clinics/index.js";
const origin = "https://dental.example.test";
const version = "10000000-0000-4000-8000-000000000001";
const body = {
  name: "Fixture",
  dentist_first_name: "Test",
  dentist_last_name: "Only",
  email: "fixture@example.invalid",
  password: "Synthetic password only",
  phone: "+000",
  address: "Fixture only",
  accepted_terms: true,
  terms_version_id: version,
};
async function setup(patch = {}) {
  const ports = {
    currentTermsVersion: vi.fn().mockResolvedValue(version),
    ownerInitialized: vi.fn().mockResolvedValue(true),
    admit: vi.fn().mockResolvedValue({ allowed: true }),
    hash: vi.fn().mockResolvedValue("fixture-hash"),
    registerAtomic: vi.fn().mockResolvedValue("created"),
    ...patch,
  };
  const logs = [];
  const server = createApp(
    (app) =>
      registerClinicRegistrationRoutes(app, {
        registration: createClinicRegistrationService(ports),
        origin,
      }),
    (entry) => logs.push(entry),
  ).listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  return {
    ports,
    logs,
    close: () => closeServer(server),
    post: (data = body, headers = {}, query = "") =>
      fetch(
        "http://127.0.0.1:" +
          server.address().port +
          "/api/v1/clinics/registration" +
          query,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: origin,
            ...headers,
          },
          body: JSON.stringify(data),
        },
      ),
  };
}
test("registration HTTP returns only pending after storage, never session or personal data", async () => {
  const f = await setup();
  try {
    const response = await f.post(body, { "X-Forwarded-For": "spoofed" });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ kind: "pending" });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(f.ports.admit.mock.calls[0]).toEqual([
      "fixture@example.invalid",
      "127.0.0.1",
    ]);
    expect(f.ports.registerAtomic.mock.calls[0][0]).toMatchObject({
      profile: "clinic",
      review_state: "pending",
    });
    expect(JSON.stringify(f.logs)).not.toContain(body.email);
    expect(JSON.stringify(f.logs)).not.toContain(body.password);
  } finally {
    await f.close();
  }
});
test("origin, content type and query gates precede service admission", async () => {
  const f = await setup();
  try {
    for (const [headers, query, status] of [
      [{ Origin: "https://other.example.test" }, "", 403],
      [{ Origin: "" }, "", 403],
      [{ "Content-Type": "text/plain" }, "", 400],
      [{}, "?profile=owner", 400],
    ])
      expect((await f.post(body, headers, query)).status).toBe(status);
    expect(f.ports.admit).not.toHaveBeenCalled();
    expect(f.ports.registerAtomic).not.toHaveBeenCalled();
  } finally {
    await f.close();
  }
});
test("invalid payloads cannot elevate privileges; paths never reflect arbitrary keys", async () => {
  const f = await setup();
  try {
    for (const patch of [
      { profile: "owner" },
      { review_state: "approved" },
      { accepted_terms: false },
      { name: "x".repeat(2001) },
      { password: "é".repeat(513) },
      { PRIVATE_MARKER: true },
    ]) {
      const response = await f.post({ ...body, ...patch });
      expect(response.status).toBe(400);
      const problem = await response.json();
      expect(problem.code).toBe("VALIDATION_FAILED");
      expect(JSON.stringify(problem)).not.toContain("PRIVATE_MARKER");
    }
    expect(f.ports.hash).not.toHaveBeenCalled();
    expect(f.ports.registerAtomic).not.toHaveBeenCalled();
  } finally {
    await f.close();
  }
});
test("limited, unavailable, consent race, conflict and private failure map safely", async () => {
  const error = new Error("PRIVATE_DATABASE_MARKER");
  for (const [patch, status, code] of [
    [
      { admit: async () => ({ allowed: false, retryAfterSeconds: 3 }) },
      429,
      "RATE_LIMITED",
    ],
    [
      { currentTermsVersion: async () => undefined },
      503,
      "DEPENDENCY_UNAVAILABLE",
    ],
    [{ ownerInitialized: async () => false }, 503, "DEPENDENCY_UNAVAILABLE"],
    [{ registerAtomic: async () => "terms_changed" }, 400, "VALIDATION_FAILED"],
    [{ registerAtomic: async () => "duplicate" }, 409, "STATE_CONFLICT"],
    [
      { registerAtomic: async () => "unavailable" },
      503,
      "DEPENDENCY_UNAVAILABLE",
    ],
    [
      {
        registerAtomic: async () => {
          throw error;
        },
      },
      500,
      "INTERNAL_ERROR",
    ],
    [
      {
        admit: async () => {
          throw error;
        },
      },
      500,
      "INTERNAL_ERROR",
    ],
  ]) {
    const f = await setup(patch);
    try {
      const response = await f.post();
      expect(response.status).toBe(status);
      expect(response.headers.get("set-cookie")).toBeNull();
      if (status === 429) expect(response.headers.get("retry-after")).toBe("3");
      const problem = await response.json();
      expect(problem.code).toBe(code);
      expect(JSON.stringify(problem)).not.toContain("PRIVATE_DATABASE_MARKER");
      expect(JSON.stringify(f.logs)).not.toContain("PRIVATE_DATABASE_MARKER");
      if (patch.admit || patch.currentTermsVersion || patch.ownerInitialized)
        expect(f.ports.hash).not.toHaveBeenCalled();
    } finally {
      await f.close();
    }
  }
});
