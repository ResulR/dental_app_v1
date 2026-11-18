import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerEmailQueueReadRoutes } from "../../apps/api/dist/modules/notifications/email-queue-read.routes.js";
const id = "94000000-0000-4000-8000-000000000001";
test("queue HTTP only accepts same-origin authenticated owner reads, never sends", async () => {
  const page = vi.fn(async () => ({
    kind: "result",
    result: { items: [], next_before: null },
  }));
  const server = createApp(
    (app) =>
      registerEmailQueueReadRoutes(app, {
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
    "http://127.0.0.1:" +
    server.address().port +
    "/api/v1/notifications/email-queue/page";
  const headers = {
    origin: "https://dental.example.test",
    "content-type": "application/json",
    cookie:
      "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
  };
  const post = (overrides = {}, body = "{}") =>
    fetch(url, {
      method: "POST",
      headers: { ...headers, ...overrides },
      body,
    });
  try {
    expect((await post({ origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ cookie: "" })).status).toBe(401);
    expect((await post({}, JSON.stringify({ clinic_id: id }))).status).toBe(
      400,
    );
    expect(page).not.toHaveBeenCalled();
    const response = await post();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ items: [], next_before: null });
    page.mockResolvedValueOnce({ kind: "denied" });
    expect((await post()).status).toBe(403);
    for (const method of ["PUT", "PATCH", "DELETE"])
      expect((await fetch(url, { method, headers, body: "{}" })).status).toBe(
        404,
      );
  } finally {
    await closeServer(server);
  }
});
