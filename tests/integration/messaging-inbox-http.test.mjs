import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerMessagingInboxRoutes } from "../../apps/api/dist/modules/messaging/index.js";
const id = "91000000-0000-4000-8000-000000000001";
test("lab inbox HTTP rejects foreign origin, anonymous, malformed pagination", async () => {
  const list = vi.fn(async () => ({ kind: "denied" }));
  const server = createApp(
    (app) =>
      registerMessagingInboxRoutes(app, {
        inbox: { list },
        sessions: {
          authenticate: async () => ({ accountId: id, sessionId: id }),
        },
        origin: "https://dental.example.test",
      }),
    () => {},
  ).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base =
    "http://127.0.0.1:" +
    server.address().port +
    "/api/v1/messaging/inbox/list";
  const headers = {
    origin: "https://dental.example.test",
    "content-type": "application/json",
    cookie:
      "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
  };
  const post = (body, hdr = headers) =>
    fetch(base, { method: "POST", headers: hdr, body: JSON.stringify(body) });
  try {
    expect(
      (await post({}, { ...headers, origin: "https://evil.example" })).status,
    ).toBe(403);
    expect((await post({}, { ...headers, cookie: "" })).status).toBe(401);
    expect((await post({ kind: "other" })).status).toBe(400);
    expect((await post({ before_id: id })).status).toBe(400);
    expect(list).not.toHaveBeenCalled();
    expect((await post({ kind: "order", unread_only: true })).status).toBe(403);
    expect(list).toHaveBeenCalledTimes(1);
  } finally {
    await closeServer(server);
  }
});
