import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerAccountStateRoutes } from "../../apps/api/dist/modules/identity/index.js";
const id = "72000000-0000-4000-8000-000000000001";
test("state HTTP rejects bad origins, injected flags, invalid targets and unauthenticated calls", async () => {
  const change = vi.fn(async () => ({ kind: "recovery_required" }));
  const server = createApp(
    (app) =>
      registerAccountStateRoutes(app, {
        origin: "https://dental.example.test",
        sessions: {
          authenticate: async () => ({
            accountId: id,
            sessionId: id,
            profile: "admin",
          }),
        },
        service: { change },
      }),
    () => {},
  ).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const url =
    "http://127.0.0.1:" + server.address().port + "/api/v1/account-state/" + id;
  const headers = {
    origin: "https://dental.example.test",
    "content-type": "application/json",
    cookie:
      "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
  };
  const input = { expected_revision: 1, operation: "reactivate" },
    body = JSON.stringify(input);
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
          body: JSON.stringify({ ...input, profile: "owner" }),
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
    const response = await fetch(url, { method: "PUT", headers, body });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ kind: "recovery_required" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  } finally {
    await closeServer(server);
  }
});
