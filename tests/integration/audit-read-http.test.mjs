import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerAuditReadRoutes } from "../../apps/api/dist/modules/audit/index.js";
const id = "94000000-0000-4000-8000-000000000001";
test("global audit HTTP rejects origin, session, unknown fields and denied actor", async () => {
  const page = vi.fn(async () => ({
    kind: "result",
    result: { items: [], next_before: null },
  }));
  const server = createApp(
    (app) =>
      registerAuditReadRoutes(app, {
        reader: { page },
        sessions: {
          authenticate: async () => ({ accountId: id, sessionId: id }),
        },
        origin: "https://dental.example.test",
      }),
    () => {},
  ).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url =
    "http://127.0.0.1:" + server.address().port + "/api/v1/audit/page";
  const headers = {
    origin: "https://dental.example.test",
    "content-type": "application/json",
    cookie:
      "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
  };
  try {
    expect(
      (
        await fetch(url, {
          method: "POST",
          headers: { ...headers, origin: "https://evil.example" },
          body: "{}",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(url, {
          method: "POST",
          headers: { ...headers, cookie: "" },
          body: "{}",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ clinic_id: id }),
        })
      ).status,
    ).toBe(400);
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      const mutation = await fetch(url, { method, headers, body: "{}" });
      expect(mutation.status).toBe(404);
    }
    expect(page).not.toHaveBeenCalled();
    const response = await fetch(url, { method: "POST", headers, body: "{}" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [], next_before: null });
    expect(response.headers.get("cache-control")).toContain("no-store");
    page.mockResolvedValueOnce({ kind: "denied" });
    expect(
      (await fetch(url, { method: "POST", headers, body: "{}" })).status,
    ).toBe(403);
  } finally {
    await closeServer(server);
  }
});
