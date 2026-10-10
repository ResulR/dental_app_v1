import { expect, test } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { readConfig } from "../../apps/api/dist/app/config.js";
import { closeServer, startServer } from "../../apps/api/dist/app/server.js";
test("real API liveness and generic unknown route; server closed", async () => {
  const server = await startServer(
    readConfig({ NODE_ENV: "test", DENTAL_LAB_PORT: "0" }),
  );
  try {
    const origin = "http://127.0.0.1:" + server.address().port;
    const health = await fetch(origin + "/health");
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    expect(health.headers.get("cache-control")).toBe("no-store");
    expect(health.headers.get("x-powered-by")).toBeNull();
    const missing = await fetch(origin + "/api/v1/unknown");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect((await missing.json()).code).toBe("RESOURCE_NOT_FOUND");
  } finally {
    await closeServer(server);
  }
});
test("malformed JSON and internal error never disclose error body or stack", async () => {
  const app = createApp((app) => {
    app.get("/test-failure", () => {
      throw new Error("SYNTHETIC_PRIVATE_MARKER");
    });
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  try {
    const origin = "http://127.0.0.1:" + server.address().port;
    const failure = await fetch(
      origin + "/test-failure?secret=SYNTHETIC_PRIVATE_MARKER",
    );
    expect(failure.status).toBe(500);
    const problem = await failure.json();
    expect(problem.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(problem)).not.toContain("SYNTHETIC_PRIVATE_MARKER");
    expect(problem).not.toHaveProperty("stack");
    const malformed = await fetch(origin + "/api/v1/unknown", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"private":"SYNTHETIC_PRIVATE_MARKER"',
    });
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).code).toBe("VALIDATION_FAILED");
  } finally {
    await closeServer(server);
  }
});
