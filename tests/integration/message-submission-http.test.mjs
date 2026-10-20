import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerMessageSubmissionRoutes } from "../../apps/api/dist/modules/messaging/index.js";
test("prepared message endpoint enforces origin, session and strict body; reports only persisted receipt", async () => {
  const id = "91000000-0000-4000-8000-000000000001";
  const send = vi.fn(async () => ({
    kind: "result",
    result: { kind: "files_not_ready", persisted: false },
  }));
  const server = createApp(
    (app) =>
      registerMessageSubmissionRoutes(app, {
        service: { send },
        sessions: {
          authenticate: async () => ({ accountId: id, sessionId: id }),
        },
        origin: "https://dental.example.test",
      }),
    () => {},
  ).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = "http://127.0.0.1:" + server.address().port + "/api/v1/messages";
  const headers = {
    origin: "https://dental.example.test",
    "content-type": "application/json",
    cookie:
      "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
  };
  const body = JSON.stringify({
    conversation_id: id,
    idempotency_key: id,
    body: null,
    file_ids: [id],
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
          body: JSON.stringify({
            conversation_id: id,
            idempotency_key: id,
            body: "x",
            file_ids: [],
            clinic_id: id,
          }),
        })
      ).status,
    ).toBe(400);
    expect(send).not.toHaveBeenCalled();
    const response = await fetch(url, { method: "POST", headers, body });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      kind: "files_not_ready",
      persisted: false,
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
    send.mockResolvedValueOnce({ kind: "denied" });
    expect((await fetch(url, { method: "POST", headers, body })).status).toBe(
      403,
    );
  } finally {
    await closeServer(server);
  }
});
