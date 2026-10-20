import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerMessageFilesRoutes } from "../../apps/api/dist/modules/messaging/index.js";
test("prepared metadata route checks origin, session, scope and never advertises download", async () => {
  const id = "91000000-0000-4000-8000-000000000001";
  const list = vi.fn(async () => ({
    kind: "page",
    page: {
      version_id: id,
      items: [],
      next_after: null,
      download_available: false,
    },
  }));
  const server = createApp(
    (app) =>
      registerMessageFilesRoutes(app, {
        files: { list },
        sessions: {
          authenticate: async () => ({ accountId: id, sessionId: id }),
        },
        origin: "https://dental.example.test",
      }),
    () => {},
  ).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url =
    "http://127.0.0.1:" + server.address().port + "/api/v1/messages/files";
  const headers = {
    origin: "https://dental.example.test",
    "content-type": "application/json",
    cookie:
      "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
  };
  const body = JSON.stringify({
    conversation_id: id,
    message_id: id,
    version_id: id,
  });
  try {
    expect(
      (
        await fetch(url, {
          method: "POST",
          headers: { ...headers, origin: "https://evil.example" },
          body,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(url, {
          method: "POST",
          headers: { ...headers, cookie: "" },
          body,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ ...JSON.parse(body), clinic_id: id }),
        })
      ).status,
    ).toBe(400);
    expect(list).not.toHaveBeenCalled();
    const response = await fetch(url, { method: "POST", headers, body });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ download_available: false });
    expect(response.headers.get("cache-control")).toContain("no-store");
    list.mockResolvedValueOnce({ kind: "denied" });
    expect((await fetch(url, { method: "POST", headers, body })).status).toBe(
      403,
    );
  } finally {
    await closeServer(server);
  }
});
