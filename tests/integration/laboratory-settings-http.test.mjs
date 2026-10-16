import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerLaboratorySettingsRoutes } from "../../apps/api/dist/modules/settings/index.js";
test("settings HTTP enforces origin JSON authentication cursor and strict fields; cache disabled", async () => {
  const actor = {
    accountId: "86000000-0000-4000-8000-000000000001",
    sessionId: "86000000-0000-4000-8000-000000000001",
  };
  const update = vi.fn(async () => ({ kind: "conflict" })),
    read = vi.fn(async () => ({ revision: 0, fields: null })),
    history = vi.fn(async () => null);
  const server = createApp(
    (app) =>
      registerLaboratorySettingsRoutes(app, {
        origin: "https://dental.example.test",
        sessions: { authenticate: async () => actor },
        service: { read, update, history },
      }),
    () => {},
  ).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url =
    "http://127.0.0.1:" + server.address().port + "/api/v1/laboratory-settings";
  const headers = {
    origin: "https://dental.example.test",
    "content-type": "application/json",
    cookie:
      "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
  };
  const fields = {
      name: null,
      address: null,
      phone: null,
      email: null,
      opening_hours: null,
      map_url: null,
    },
    body = JSON.stringify({ expected_revision: 0, fields });
  try {
    expect((await fetch(url)).status).toBe(401);
    expect((await fetch(url + "?secret=1", { headers })).status).toBe(400);
    expect(
      (
        await fetch(url, {
          method: "PUT",
          headers: { ...headers, origin: "https://evil.example" },
          body,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(url, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            expected_revision: 0,
            fields: { ...fields, price: 2 },
          }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(url, {
          method: "PUT",
          headers: { ...headers, cookie: "" },
          body,
        })
      ).status,
    ).toBe(401);
    expect(update).not.toHaveBeenCalled();
    expect((await fetch(url, { method: "PUT", headers, body })).status).toBe(
      409,
    );
    expect((await fetch(url + "/history?before=bad", { headers })).status).toBe(
      400,
    );
    expect((await fetch(url + "/history", { headers })).status).toBe(403);
    const response = await fetch(url, { headers });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ revision: 0, fields: null });
  } finally {
    await closeServer(server);
  }
});
