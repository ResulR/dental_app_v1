import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerDelegationRoutes } from "../../apps/api/dist/modules/permissions/index.js";
const id = "71000000-0000-4000-8000-000000000001";
test("delegation HTTP rejects untrusted input before business writes and preserves confirmation/conflict results", async () => {
  let result = { kind: "confirmation_required", dropped_codes: ["files.view"] };
  const change = vi.fn(async () => result),
    service = {
      change,
      list: async () => ({ items: [], next_after: null }),
      profile: async () => null,
      history: async () => null,
    };
  const server = createApp(
    (app) =>
      registerDelegationRoutes(app, {
        service,
        authenticate: async (cookie) =>
          cookie === "fixture=valid" ? { accountId: id, sessionId: id } : null,
        originAllowed: (origin) => origin === "https://dental.example.test",
      }),
    () => {},
  ).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const url =
    "http://127.0.0.1:" +
    server.address().port +
    "/api/v1/delegation/employee/" +
    id;
  const headers = {
      origin: "https://dental.example.test",
      "content-type": "application/json",
      cookie: "fixture=valid",
    },
    body = JSON.stringify({ expected_revision: 1, permission_codes: [] });
  try {
    expect(
      (
        await fetch(url, {
          method: "PUT",
          headers: { ...headers, origin: "https://evil.example" },
          body,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(url, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            expected_revision: 1,
            permission_codes: [],
            owner: true,
          }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(url, {
          method: "PUT",
          headers: { ...headers, cookie: "" },
          body,
        })
      ).status,
    ).toBe(401);
    expect(
      (await fetch(url.replace(id, "bad"), { method: "PUT", headers, body }))
        .status,
    ).toBe(400);
    expect(change).not.toHaveBeenCalled();
    const confirmation = await fetch(url, { method: "PUT", headers, body });
    expect(confirmation.status).toBe(200);
    expect(await confirmation.json()).toEqual(result);
    expect(confirmation.headers.get("cache-control")).toContain("no-store");
    result = { kind: "conflict" };
    expect((await fetch(url, { method: "PUT", headers, body })).status).toBe(
      409,
    );
    expect((await fetch(url + "/history?before=bad", { headers })).status).toBe(
      400,
    );
  } finally {
    await closeServer(server);
  }
});
