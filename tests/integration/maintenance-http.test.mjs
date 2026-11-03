import { test, expect } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { registerMaintenanceRoutes } from "../../apps/api/dist/modules/settings/maintenance.routes.js";
test("owner route rejects unauthenticated and foreign-origin writes", async () => {
  const repository = {
    read: async () => ({ active: false, revision: 0 }),
    history: async () => [],
    update: async () => ({ kind: "applied", revision: 1 }),
  };
  const sessions = {
    authenticate: async (token) =>
      token === "valid"
        ? {
            accountId: "91000000-0000-4000-8000-000000000001",
            sessionId: "91000000-0000-4000-8000-000000000002",
          }
        : null,
  };
  const app = createApp((a) =>
    registerMaintenanceRoutes(a, {
      repository,
      sessions,
      origin: "https://example.invalid",
    }),
  );
  const server = app.listen(0);
  try {
    const address = server.address(),
      base = "http://127.0.0.1:" + address.port;
    let r = await fetch(base + "/api/v1/maintenance/state");
    expect(r.status).toBe(401);
    r = await fetch(base + "/api/v1/maintenance/state", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: "session=valid" },
      body: "{}",
    });
    expect(r.status).toBe(403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
