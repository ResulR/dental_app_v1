import { randomBytes } from "node:crypto";
import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { registerMaintenanceRoutes } from "../../apps/api/dist/modules/settings/maintenance.routes.js";

test("maintenance routes require current session and same-origin owner mutation", async () => {
  const token = randomBytes(32).toString("base64url");
  const update = vi.fn(async () => ({ kind: "applied", revision: 1 }));
  const repository = {
    notice: async () => ({
      active: false,
      message: "",
      planned_at: null,
      planned_message: "",
    }),
    read: async () => ({ active: false, revision: 0 }),
    history: async () => [],
    update,
  };
  const sessions = {
    authenticate: async (candidate) =>
      candidate === token
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
    const address = server.address();
    const base = "http://127.0.0.1:" + address.port;
    const cookie = "__Host-dental_session=" + token;
    let response = await fetch(base + "/api/v1/maintenance/notice");
    expect(response.status).toBe(401);
    response = await fetch(base + "/api/v1/maintenance/notice", {
      headers: { cookie },
    });
    expect(response.status).toBe(200);
    response = await fetch(base + "/api/v1/maintenance/state", {
      method: "PUT",
      headers: {
        cookie,
        origin: "https://other.invalid",
        "content-type": "application/json",
      },
      body: "{}",
    });
    expect(response.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
    response = await fetch(base + "/api/v1/maintenance/state", {
      method: "PUT",
      headers: {
        cookie,
        origin: "https://example.invalid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        expected_revision: 0,
        active: false,
        message: "",
        planned_at: null,
        planned_message: "",
      }),
    });
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledOnce();
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
