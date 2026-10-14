import { test, expect, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { registerClinicManagementRoutes } from "../../apps/api/dist/modules/clinics/index.js";
const id = "70000000-0000-4000-8000-000000000001",
  clinic = "70000000-0000-4000-8000-000000000002";
test("profile HTTP validates origin, strict body and session before persistence", async () => {
  const transaction = vi.fn(async () => {
    throw new Error("UNEXPECTED_SQL");
  });
  const server = createApp((app) =>
    registerClinicManagementRoutes(app, {
      sessions: { authenticate: async () => null },
      database: { transaction },
      origin: "https://dental.example.test",
    }),
  ).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const url =
    "http://127.0.0.1:" +
    server.address().port +
    "/api/v1/clinics/" +
    clinic +
    "/profile";
  const headers = {
    "content-type": "application/json",
    origin: "https://dental.example.test",
    cookie:
      "__Host-dental_session=" + Buffer.alloc(32, 1).toString("base64url"),
  };
  const data = {
    name: "Fixture",
    dentist_first_name: "Test",
    dentist_last_name: "Only",
    phone: "+000",
    address: "Fixture",
    expected_revision: 1,
  };
  try {
    expect(
      (
        await fetch(url, {
          method: "PUT",
          headers: { ...headers, origin: "https://evil.example" },
          body: JSON.stringify(data),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(url, {
          method: "PUT",
          headers,
          body: JSON.stringify({ ...data, account_id: id }),
        })
      ).status,
    ).toBe(400);
    expect(
      (await fetch(url, { method: "PUT", headers, body: JSON.stringify(data) }))
        .status,
    ).toBe(401);
    expect((await fetch(url + "/history?before=NaN", { headers })).status).toBe(
      400,
    );
    expect(transaction).not.toHaveBeenCalled();
  } finally {
    await closeServer(server);
  }
});
