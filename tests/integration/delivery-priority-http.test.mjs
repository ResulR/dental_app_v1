import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerDeliveryPriorityRoutes } from "../../apps/api/dist/modules/orders/index.js";
test("priority route verifies origin, session, strict command and outcome", async () => {
  const id = "91000000-0000-4000-8000-000000000001";
  const update = vi.fn(async () => ({
    kind: "result",
    result: { kind: "updated", priority: true, logistics_revision: 2 },
  }));
  const context = vi.fn(async () => ({
    kind: "result",
    result: {
      order_id: id,
      version_id: id,
      status: "accepted",
      order_revision: 1,
      logistics_revision: 1,
      priority: false,
      recent_changes: [],
      more_history: false,
    },
  }));
  const server = createApp(
    (app) =>
      registerDeliveryPriorityRoutes(app, {
        service: { update, context },
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
    "/api/v1/orders/delivery-priority-";
  const headers = {
    origin: "https://dental.example.test",
    "content-type": "application/json",
    cookie:
      "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
  };
  const body = JSON.stringify({
    order_id: id,
    expected_version_id: id,
    expected_order_revision: 1,
    expected_logistics_revision: 1,
    priority: true,
  });
  try {
    expect(
      (
        await fetch(url + "update", {
          method: "POST",
          headers: { ...headers, origin: "https://evil.example" },
          body,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(url + "update", {
          method: "POST",
          headers: { ...headers, cookie: "" },
          body,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await fetch(url + "update", {
          method: "POST",
          headers,
          body: JSON.stringify({ ...JSON.parse(body), clinic_id: id }),
        })
      ).status,
    ).toBe(400);
    expect(update).not.toHaveBeenCalled();
    const sent = await fetch(url + "update", { method: "POST", headers, body });
    expect(sent.status).toBe(200);
    expect(await sent.json()).toEqual({
      kind: "updated",
      priority: true,
      logistics_revision: 2,
    });
    expect(sent.headers.get("cache-control")).toContain("no-store");
    expect(
      (
        await fetch(url + "context", {
          method: "POST",
          headers,
          body: JSON.stringify({ order_id: id }),
        })
      ).status,
    ).toBe(200);
    update.mockResolvedValueOnce({ kind: "denied" });
    expect(
      (await fetch(url + "update", { method: "POST", headers, body })).status,
    ).toBe(403);
  } finally {
    await closeServer(server);
  }
});
