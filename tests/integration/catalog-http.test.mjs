import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerCatalogRoutes } from "../../apps/api/dist/modules/catalog/index.js";
const id = "81000000-0000-4000-8000-000000000001";
test("catalog HTTP validates parameters, authenticates and refuses unavailable scope", async () => {
  const list = vi.fn(async () => ({ items: [], next_after: null }));
  const server = createApp(
    (app) =>
      registerCatalogRoutes(app, {
        service: { list },
        authenticate: async (cookie) =>
          cookie ? { accountId: id, sessionId: id } : null,
      }),
    () => {},
  ).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = "http://127.0.0.1:" + server.address().port + "/api/v1/catalog/";
  const headers = { cookie: "synthetic" };
  try {
    expect((await fetch(url + "shade")).status).toBe(401);
    for (const suffix of ["bad", "shade?after=bad", "shade?include=forbidden"])
      expect((await fetch(url + suffix, { headers })).status).toBe(400);
    expect(list).not.toHaveBeenCalled();
    const response = await fetch(url + "shade", { headers });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ items: [], next_after: null });
    list.mockResolvedValueOnce(null);
    expect((await fetch(url + "shade", { headers })).status).toBe(403);
  } finally {
    await closeServer(server);
  }
});
