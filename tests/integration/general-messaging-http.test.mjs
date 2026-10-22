import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerGeneralMessagingRoutes } from "../../apps/api/dist/modules/messaging/index.js";
const id = "91000000-0000-4000-8000-000000000001";
test("general routes forbid foreign origin, anonymous access, files and non-general submissions", async () => {
  const conversations = vi.fn(async () => ({
    kind: "result",
    result: { items: [], next_after: null },
  }));
  const messages = vi.fn(async () => ({ kind: "denied" }));
  const markRead = vi.fn(async () => ({
    kind: "result",
    result: { conversation_id: id, last_read_seq: 1 },
  }));
  const send = vi.fn(async () => ({
    kind: "result",
    result: { kind: "sent" },
  }));
  const server = createApp(
    (app) =>
      registerGeneralMessagingRoutes(app, {
        reader: { conversations, messages, markRead },
        sender: { send },
        sessions: {
          authenticate: async () => ({ accountId: id, sessionId: id }),
        },
        origin: "https://dental.example.test",
      }),
    () => {},
  ).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base =
    "http://127.0.0.1:" + server.address().port + "/api/v1/messaging/general/";
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
  const payload = {
    conversation_id: id,
    idempotency_key: id,
    body: "Synthetic",
    file_ids: [],
  };
  try {
    expect(
      (
        await post("send", payload, {
          ...headers,
          origin: "https://evil.example",
        })
      ).status,
    ).toBe(403);
    expect(
      (await post("send", payload, { ...headers, cookie: "" })).status,
    ).toBe(401);
    expect((await post("send", { ...payload, file_ids: [id] })).status).toBe(
      400,
    );
    expect(
      (await post("send", { ...payload, body: null, file_ids: [id] })).status,
    ).toBe(400);
    expect(send).not.toHaveBeenCalled();
    expect((await post("messages", { conversation_id: id })).status).toBe(403);
    expect(
      (await post("messages", { conversation_id: id, after_seq: -1 })).status,
    ).toBe(400);
    expect(
      (
        await post("messages", {
          conversation_id: id,
          after_seq: 0,
          before_seq: 2,
        })
      ).status,
    ).toBe(400);
    expect((await post("conversations", {})).status).toBe(200);
    expect(conversations).toHaveBeenCalledTimes(1);
    expect(
      (await post("markRead", { conversation_id: id, through_seq: 0 })).status,
    ).toBe(400);
    expect(markRead).not.toHaveBeenCalled();
    expect(
      (
        await post(
          "markRead",
          { conversation_id: id, through_seq: 1 },
          { ...headers, origin: "https://evil.example" },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await post(
          "markRead",
          { conversation_id: id, through_seq: 1 },
          { ...headers, cookie: "" },
        )
      ).status,
    ).toBe(401);
    const receipt = await post("markRead", {
      conversation_id: id,
      through_seq: 1,
    });
    expect(receipt.status).toBe(200);
    expect(await receipt.json()).toEqual({
      conversation_id: id,
      last_read_seq: 1,
    });
    expect(markRead).toHaveBeenCalledTimes(1);
    expect((await post("send", payload)).status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
  } finally {
    await closeServer(server);
  }
});
