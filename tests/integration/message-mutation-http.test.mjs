import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerOrderMessagingRoutes } from "../../apps/api/dist/modules/messaging/index.js";
const id = "91000000-0000-4000-8000-000000000001";
test("message mutations authenticate, validate action shape and keep scope in repository", async () => {
  const mutate = vi.fn(async () => ({ kind: "denied" }));
  const history = vi.fn(async () => ({ kind: "denied" }));
  const server = createApp(
    (app) =>
      registerOrderMessagingRoutes(app, {
        reader: { mutate, history },
        sender: { send: vi.fn() },
        sessions: {
          authenticate: async () => ({ accountId: id, sessionId: id }),
        },
        origin: "https://dental.example.test",
      }),
    () => {},
  ).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base =
    "http://127.0.0.1:" + server.address().port + "/api/v1/messaging/order/";
  const headers = {
    origin: "https://dental.example.test",
    "content-type": "application/json",
    cookie:
      "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
  };
  const post = (route, body, hdr = headers) =>
    fetch(base + route, {
      method: "POST",
      headers: hdr,
      body: JSON.stringify(body),
    });
  const command = {
    conversation_id: id,
    message_id: id,
    expected_revision: 1,
    body: "Teksti",
  };
  try {
    expect(
      (
        await post("edit", command, {
          ...headers,
          origin: "https://evil.example",
        })
      ).status,
    ).toBe(403);
    expect(
      (await post("edit", command, { ...headers, cookie: "" })).status,
    ).toBe(401);
    expect(
      (await post("edit", { ...command, expected_revision: 0 })).status,
    ).toBe(400);
    expect((await post("edit", { ...command, body: undefined })).status).toBe(
      400,
    );
    expect((await post("hide", command)).status).toBe(400);
    expect(mutate).not.toHaveBeenCalled();
    expect((await post("edit", command)).status).toBe(403);
    expect(
      (
        await post("hide", {
          conversation_id: id,
          message_id: id,
          expected_revision: 1,
        })
      ).status,
    ).toBe(403);
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(mutate.mock.calls[0][2]).toBe("edit");
    expect(mutate.mock.calls[1][2]).toBe("hide");
    expect(
      (await post("history", { conversation_id: id, message_id: id })).status,
    ).toBe(403);
    expect(history).toHaveBeenCalledTimes(1);
  } finally {
    await closeServer(server);
  }
});
