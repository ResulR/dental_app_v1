import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerClinicManagementRoutes } from "../../apps/api/dist/modules/clinics/index.js";
const id = "70000000-0000-4000-8000-000000000001";
test("directory HTTP is private, validates cursor and rechecks current manager rights", async () => {
  let managed = true;
  const query = vi.fn(async (sql) => {
    if (sql.includes("SELECT s.id")) return { rows: [{ id }] };
    if (sql.includes("SELECT a.profile"))
      return { rows: [{ profile: "admin", owner: false, managed }] };
    if (sql.startsWith("SELECT id,name,"))
      return {
        rows: [
          {
            id,
            name: "Fixture",
            revision: "2",
            review_state: "approved",
            suspended: false,
          },
        ],
      };
    return { rows: [] };
  });
  const server = createApp(
    (app) =>
      registerClinicManagementRoutes(app, {
        origin: "https://dental.example.test",
        sessions: {
          authenticate: async () => ({
            accountId: id,
            sessionId: id,
            profile: "admin",
          }),
        },
        database: { transaction: async (fn) => fn({ query }) },
      }),
    () => {},
  ).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const url =
    "http://127.0.0.1:" + server.address().port + "/api/v1/clinics/directory";
  const headers = {
    cookie:
      "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
  };
  try {
    expect((await fetch(url)).status).toBe(401);
    for (const suffix of [
      "?after=bad",
      "?after=" + id + "&after=" + id,
      "?account_id=" + id,
    ])
      expect((await fetch(url + suffix, { headers })).status).toBe(400);
    const prefix = url.replace("/directory", "");
    for (const [path, method, body] of [
      ["/pending?after=bad", "GET"],
      ["/bad/profile", "GET"],
      ["/bad/profile/history", "GET"],
      [
        "/bad/profile",
        "PUT",
        {
          name: "Fixture",
          dentist_first_name: "A",
          dentist_last_name: "B",
          phone: "+000",
          address: "Fixture",
          expected_revision: 1,
        },
      ],
      ["/bad/review", "POST", { expected_revision: 1, decision: "approved" }],
    ])
      expect(
        (
          await fetch(prefix + path, {
            method,
            headers: {
              ...headers,
              origin: "https://dental.example.test",
              "content-type": "application/json",
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          })
        ).status,
      ).toBe(400);
    expect(query).not.toHaveBeenCalled();
    const response = await fetch(url, { headers });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect((await response.json()).items[0].review_state).toBe("approved");
    managed = false;
    expect((await fetch(url, { headers })).status).toBe(403);
  } finally {
    await closeServer(server);
  }
});
