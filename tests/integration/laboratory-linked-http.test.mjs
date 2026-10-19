import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerLaboratoryLinkedWorkRoutes } from "../../apps/api/dist/modules/linked-works/index.js";
test("laboratory linked HTTP enforces origin session strict body and returns only committed service receipt", async () => {
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
      registerLaboratoryLinkedWorkRoutes(app, {
        service: { submit },
        sessions: { authenticate: async () => actor },
        origin: "https://dental.example.test",
      }),
    () => {},
  ).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url =
      "http://127.0.0.1:" +
      server.address().port +
      "/api/v1/orders/laboratory-linked",
    headers = {
      origin: "https://dental.example.test",
      "content-type": "application/json",
      cookie:
        "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
    };
  const input = {
      patient: { internal_reference: "Synthetic" },
      material_id: id,
      shade_id: id,
      description: "New work",
      requested_delivery_date: null,
      teeth: [],
      file_ids: [],
    },
    body = JSON.stringify({
      input,
      source_order_id: id,
      expected_source_version_id: id,
      expected_source_revision: 1,
      kind: "replacement",
      reason: "Synthetic reason",
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
