import { expect, test, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerInternalNoticeRoutes } from "../../apps/api/dist/modules/notifications/index.js";
const id = "91000000-0000-4000-8000-000000000001";
test("internal notice routes reject foreign origin, missing session and malformed requests", async () => {
  const list = vi.fn(async () => ({ kind: "denied" }));
  const markRead = vi.fn(async () => ({ kind: "denied" }));
  const server = createApp(
    (app) =>
      registerInternalNoticeRoutes(app, {
        notices: { list, markRead },
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
    "/api/v1/notifications/internal/";
  const headers = {
    origin: "https://dental.example.test",
    "content-type": "application/json",
    cookie:
      "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
  };
  const post = (path, body, h = headers) =>
    fetch(base + path, {
      method: "POST",
      headers: h,
      body: JSON.stringify(body),
    });
  try {
    expect(
      (await post("list", {}, { ...headers, origin: "https://evil.example" }))
        .status,
    ).toBe(403);
    expect((await post("list", {}, { ...headers, cookie: "" })).status).toBe(
      401,
    );
    expect((await post("list", { before_id: id })).status).toBe(400);
    expect((await post("read", {})).status).toBe(400);
    expect((await post("read", { id })).status).toBe(403);
    expect(markRead).toHaveBeenCalledTimes(1);
    expect(list).not.toHaveBeenCalled();
  } finally {
    await closeServer(server);
  }
});
