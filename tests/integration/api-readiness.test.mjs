import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { registerReadinessRoute } from "../../apps/api/dist/app/readiness.js";
import { closeServer } from "../../apps/api/dist/app/server.js";

async function serve(query) {
  const server = createApp(
    (app) => registerReadinessRoute(app, { query }),
    () => {},
  ).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return {
    server,
    url: "http://127.0.0.1:" + server.address().port + "/ready",
  };
}

test("readiness distinguishes a working database from process liveness", async () => {
  const query = vi.fn(async () => ({ rows: [{ ready: 1 }] }));
  const { server, url } = await serve(query);
  try {
    const ready = await fetch(url);
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({ status: "ok" });
    expect(ready.headers.get("cache-control")).toBe("no-store");
    expect(query).toHaveBeenCalledWith("SELECT 1 AS ready");
    const invalid = await fetch(url + "?secret=synthetic");
    expect(invalid.status).toBe(400);
    expect(query).toHaveBeenCalledTimes(1);
  } finally {
    await closeServer(server);
  }
});

test("unavailable database returns a generic 503 while liveness stays available", async () => {
  const { server, url } = await serve(async () => {
    throw new Error("SYNTHETIC_DATABASE_SECRET");
  });
  try {
    const response = await fetch(url);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect(
      await (await fetch(url.replace("/ready", "/health"))).json(),
    ).toEqual({
      status: "ok",
    });
  } finally {
    await closeServer(server);
  }
});
