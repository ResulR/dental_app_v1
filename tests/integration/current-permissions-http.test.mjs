import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerAuthenticationRoutes } from "../../apps/api/dist/modules/identity/index.js";
const accountId = "70000000-0000-4000-8000-000000000001",
  sessionId = "70000000-0000-4000-8000-000000000002";
test("permissions HTTP authenticates, rejects selectors, returns no-store current rights and generic failures", async () => {
  let current = {
    account_id: accountId,
    profile: "employee",
    permissions: ["clinics.manage"],
  };
  const currentPermissions = vi.fn(async () => current);
  const server = createApp(
    (app) =>
      registerAuthenticationRoutes(app, {
        origin: "https://dental.example.test",
        authentication: {},
        sessions: {
          authenticate: async () => ({
            accountId,
            sessionId,
            profile: "employee",
          }),
        },
        currentPermissions,
      }),
    () => {},
  ).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const url =
    "http://127.0.0.1:" + server.address().port + "/api/v1/auth/permissions";
  const headers = {
    cookie:
      "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
  };
  try {
    expect((await fetch(url)).status).toBe(401);
    expect(
      (await fetch(url + "?account_id=" + accountId, { headers })).status,
    ).toBe(400);
    expect(currentPermissions).not.toHaveBeenCalled();
    const response = await fetch(url, { headers });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual(current);
    expect(currentPermissions.mock.calls[0][0]).toMatchObject({
      accountId,
      sessionId,
    });
    current = null;
    expect((await fetch(url, { headers })).status).toBe(401);
    current = { account_id: sessionId, profile: "employee", permissions: [] };
    const mismatch = await fetch(url, { headers });
    expect(mismatch.status).toBe(500);
    expect(await mismatch.text()).not.toContain("PERMISSION_IDENTITY_MISMATCH");
  } finally {
    await closeServer(server);
  }
});
