import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerOrderSimilarityRoutes } from "../../apps/api/dist/modules/orders/index.js";

test("similarity HTTP enforces origin, session and strict tenant-free input", async () => {
  const id = "91000000-0000-4000-8000-000000000001";
  const result = {
    matches: [{ order_id: id, number: "5", signal: "same_name_and_work" }],
  };
  const check = vi.fn(async () => ({ kind: "checked", result }));
  const server = createApp(
    (app) =>
      registerOrderSimilarityRoutes(app, {
        service: { check },
        sessions: {
          authenticate: async () => ({ accountId: id, sessionId: id }),
        },
        origin: "https://dental.example.test",
      }),
    () => {},
  ).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url =
    "http://127.0.0.1:" + server.address().port + "/api/v1/orders/similar";
  const headers = {
    origin: "https://dental.example.test",
    "content-type": "application/json",
    cookie:
      "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
  };
  const input = {
    patient: { internal_reference: "Synthetic" },
    requested_delivery_date: "2026-11-01",
    material_id: id,
    shade_id: id,
    teeth: [],
    file_ids: [],
  };
  const send = (h, body = input, endpoint = url) =>
    fetch(endpoint, { method: "POST", headers: h, body: JSON.stringify(body) });
  try {
    expect(
      (await send({ ...headers, origin: "https://evil.example" })).status,
    ).toBe(403);
    expect((await send({ ...headers, cookie: "" })).status).toBe(401);
    expect((await send(headers, { ...input, clinic_id: id })).status).toBe(400);
    expect((await send(headers, input, url + "?clinic_id=" + id)).status).toBe(
      400,
    );
    expect(check).not.toHaveBeenCalled();
    const response = await send(headers);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(check).toHaveBeenCalledTimes(1);
  } finally {
    await closeServer(server);
  }
});
