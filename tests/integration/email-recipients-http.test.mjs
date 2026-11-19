import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerEmailRecipientsRoutes } from "../../apps/api/dist/modules/notifications/email-recipients.routes.js";
const id = "94000000-0000-4000-8000-000000000002";
test("direct recipient API refuses foreign origin, missing session and unknown category", async () => {
  const list = vi.fn(async () => ({ kind: "result", categories: [] }));
  const change = vi.fn(async () => ({ kind: "applied" }));
  const server = createApp(
    (app) =>
      registerEmailRecipientsRoutes(app, {
        repository: { list, change },
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
    "/api/v1/notifications/email-recipients/" +
    id;
  const headers = {
    origin: "https://dental.example.test",
    "content-type": "application/json",
    cookie:
      "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
  };
  const put = (body, extra = {}) =>
    fetch(url, {
      method: "PUT",
      headers: { ...headers, ...extra },
      body: JSON.stringify(body),
    });
  const body = {
    category: "order_submitted",
    selected: true,
    expected_selected: false,
  };
  try {
    expect((await put(body, { origin: "https://evil.example" })).status).toBe(
      403,
    );
    expect((await put(body, { cookie: "" })).status).toBe(401);
    expect((await put({ ...body, category: "security_alert" })).status).toBe(
      400,
    );
    expect(change).not.toHaveBeenCalled();
    expect((await put(body)).status).toBe(200);
    expect(change).toHaveBeenCalledWith(
      { accountId: id, sessionId: id },
      id,
      "order_submitted",
      false,
      true,
    );
    list.mockResolvedValueOnce({ kind: "denied" });
    expect((await fetch(url, { headers })).status).toBe(403);
  } finally {
    await closeServer(server);
  }
});
