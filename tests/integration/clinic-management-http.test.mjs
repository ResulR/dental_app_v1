import { expect, test, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerClinicManagementRoutes } from "../../apps/api/dist/modules/clinics/index.js";
const id = "70000000-0000-4000-8000-000000000001",
  clinic = "70000000-0000-4000-8000-000000000002";
test("clinic HTTP enforces session, origin, strict input and revision conflict with real service", async () => {
  const transaction = vi.fn(async (work) =>
    work({
      query: async (sql) => {
        if (sql.includes("SELECT s.id")) return { rows: [{ id }] };
        if (sql.includes("SELECT a.profile"))
          return { rows: [{ profile: "admin", owner: false, managed: true }] };
        if (sql.includes("SELECT revision::text"))
          return { rows: [{ revision: "2", review_state: "pending" }] };
        return { rows: [] };
      },
    }),
  );
  const sessions = {
    authenticate: vi.fn(async () => ({
      accountId: id,
      sessionId: id,
      profile: "admin",
    })),
  };
  const app = createApp((app) =>
    registerClinicManagementRoutes(app, {
      sessions,
      database: { transaction },
      origin: "https://dental.example.test",
    }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url =
    "http://127.0.0.1:" +
    server.address().port +
    "/api/v1/clinics/" +
    clinic +
    "/review";
  const headers = {
    "content-type": "application/json",
    origin: "https://dental.example.test",
    cookie:
      "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
  };
  const body = JSON.stringify({ expected_revision: 1, decision: "approved" });
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
          headers,
          body: JSON.stringify({
            expected_revision: 1,
            decision: "approved",
            actor_id: id,
          }),
        })
      ).status,
    ).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
    expect(
      (
        await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: headers.origin,
          },
          body,
        })
      ).status,
    ).toBe(401);
    const conflict = await fetch(url, { method: "POST", headers, body });
    expect(conflict.status).toBe(409);
    expect(conflict.headers.get("cache-control")).toContain("no-store");
    expect(conflict.headers.get("set-cookie")).toBeNull();
    expect(
      (await fetch(url + "?force=true", { method: "POST", headers, body }))
        .status,
    ).toBe(400);
  } finally {
    await closeServer(server);
  }
});
