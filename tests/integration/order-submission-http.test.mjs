import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerOrderSubmissionRoutes } from "../../apps/api/dist/modules/orders/index.js";
test("submission HTTP enforces origin session strict body and returns only committed service receipt", async () => {
  const id = "91000000-0000-4000-8000-000000000001",
    actor = { accountId: id, sessionId: id };
  const result = {
      kind: "submitted",
      persisted: true,
      order_id: id,
      number: "1",
      received_at: "2026-10-16T12:00:00.000Z",
      replayed: false,
    },
    submit = vi.fn(async () => ({ kind: "result", result }));
  const server = createApp(
    (app) =>
      registerOrderSubmissionRoutes(app, {
        service: { submit },
        sessions: { authenticate: async () => actor },
        origin: "https://dental.example.test",
      }),
    () => {},
  ).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = "http://127.0.0.1:" + server.address().port + "/api/v1/orders",
    headers = {
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
    },
    body = JSON.stringify({
      input,
      idempotency_key: id,
      confirmed_warnings: true,
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
          body: JSON.stringify({ ...input, clinic_id: id }),
        })
      ).status,
    ).toBe(400);
    expect(submit).not.toHaveBeenCalled();
    const response = await fetch(url, { method: "POST", headers, body });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(response.headers.get("cache-control")).toContain("no-store");
  } finally {
    await closeServer(server);
  }
});
