import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerDeliveryBatchRoutes } from "../../apps/api/dist/modules/orders/index.js";
const id = "93000000-0000-4000-8000-000000000001";
test("batch delivery routes require origin, session and strict payload; receipt is consultable", async () => {
  const deliver = vi.fn(async () => ({
    kind: "result",
    result: {
      kind: "delivered",
      receipt_id: id,
      delivered_at: "2026-10-21T10:00:00Z",
      items: [
        { order_id: id, revision: 2 },
        { order_id: "93000000-0000-4000-8000-000000000002", revision: 2 },
      ],
    },
  }));
  const receipt = vi.fn(async () => ({
    kind: "result",
    result: { kind: "receipt_missing" },
  }));
  const server = createApp(
    (app) =>
      registerDeliveryBatchRoutes(app, {
        service: { deliver, receipt },
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
    "/api/v1/orders/delivery-batch-";
  const headers = {
    origin: "https://dental.example.test",
    "content-type": "application/json",
    cookie:
      "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
  };
  const body = JSON.stringify({
    receipt_id: id,
    confirmed: true,
    items: [
      {
        order_id: id,
        expected_version_id: id,
        expected_revision: 1,
        mode: "clinic_pickup",
      },
      {
        order_id: "93000000-0000-4000-8000-000000000002",
        expected_version_id: id,
        expected_revision: 1,
        mode: "clinic_pickup",
      },
    ],
  });
  try {
    expect(
      (
        await fetch(url + "deliver", {
          method: "POST",
          headers: { ...headers, origin: "https://evil.example" },
          body,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(url + "deliver", {
          method: "POST",
          headers: { ...headers, cookie: "" },
          body,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await fetch(url + "deliver", {
          method: "POST",
          headers,
          body: JSON.stringify({ ...JSON.parse(body), clinic_id: id }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(url + "deliver", {
          method: "POST",
          headers,
          body: JSON.stringify({
            ...JSON.parse(body),
            items: [JSON.parse(body).items[0], JSON.parse(body).items[0]],
          }),
        })
      ).status,
    ).toBe(400);
    expect(deliver).not.toHaveBeenCalled();
    const response = await fetch(url + "deliver", {
      method: "POST",
      headers,
      body,
    });
    expect(response.status).toBe(200);
    expect((await response.json()).items).toHaveLength(2);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const consult = await fetch(url + "receipt", {
      method: "POST",
      headers,
      body: JSON.stringify({ receipt_id: id }),
    });
    expect((await consult.json()).kind).toBe("receipt_missing");
    receipt.mockResolvedValueOnce({ kind: "denied" });
    expect(
      (
        await fetch(url + "receipt", {
          method: "POST",
          headers,
          body: JSON.stringify({ receipt_id: id }),
        })
      ).status,
    ).toBe(403);
  } finally {
    await closeServer(server);
  }
});
