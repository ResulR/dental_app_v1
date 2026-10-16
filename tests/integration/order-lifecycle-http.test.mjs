import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerOrderLifecycleRoutes } from "../../apps/api/dist/modules/orders/index.js";
test("lifecycle HTTP enforces origin current session strict command and no-store", async () => {
  const id = "91000000-0000-4000-8000-000000000001",
    actor = { accountId: id, sessionId: id };
  const result = {
      kind: "updated",
      order_id: id,
      status: "completed",
      revision: 2,
      version_id: id,
    },
    decide = vi.fn(async () => ({ kind: "result", result }));
  const server = createApp(
    (app) =>
      registerOrderLifecycleRoutes(app, {
        service: { decide, context: async () => ({ kind: "denied" }) },
        sessions: { authenticate: async () => actor },
        origin: "https://dental.example.test",
      }),
    () => {},
  ).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url =
      "http://127.0.0.1:" + server.address().port + "/api/v1/orders/lifecycle",
    headers = {
      origin: "https://dental.example.test",
      "content-type": "application/json",
      cookie:
        "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
    };
  const input = {
      order_id: id,
      expected_version_id: id,
      expected_revision: 1,
      action: "complete",
    },
    body = JSON.stringify(input);
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
          body: JSON.stringify({ ...input, clinic_id: id }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(url + "-context", {
          method: "POST",
          headers,
          body: JSON.stringify({ order_id: id }),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(url + "-context", {
          method: "POST",
          headers,
          body: JSON.stringify({ order_id: id, clinic_id: id }),
        })
      ).status,
    ).toBe(400);
    expect(decide).not.toHaveBeenCalled();
    const response = await fetch(url, { method: "POST", headers, body });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(response.headers.get("cache-control")).toContain("no-store");
  } finally {
    await closeServer(server);
  }
});
