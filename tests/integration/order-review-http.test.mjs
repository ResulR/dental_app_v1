import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerOrderReviewRoutes } from "../../apps/api/dist/modules/orders/index.js";
test("private review endpoint authenticates, rejects query injection, propagates denial and never caches patient response", async () => {
  const id = "91000000-0000-4000-8000-000000000001",
    actor = { accountId: id, sessionId: id },
    list = vi.fn(async () => ({
      kind: "page",
      page: { items: [], next_after: null },
    }));
  const server = createApp(
    (app) =>
      registerOrderReviewRoutes(app, {
        service: { list },
        sessions: { authenticate: async () => actor },
      }),
    () => {},
  ).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url =
      "http://127.0.0.1:" + server.address().port + "/api/v1/orders/review",
    headers = {
      cookie:
        "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
    };
  try {
    expect((await fetch(url)).status).toBe(401);
    expect((await fetch(url + "?clinic_id=" + id, { headers })).status).toBe(
      400,
    );
    expect(list).not.toHaveBeenCalled();
    const response = await fetch(url, { headers });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ items: [], next_after: null });
    list.mockResolvedValueOnce({ kind: "denied" });
    expect((await fetch(url, { headers })).status).toBe(403);
    list.mockRejectedValueOnce(new Error("SyntheticPatientMustNotEscape"));
    const error = await fetch(url, { headers });
    expect(error.status).toBe(500);
    expect(await error.text()).not.toContain("SyntheticPatientMustNotEscape");
  } finally {
    await closeServer(server);
  }
});
