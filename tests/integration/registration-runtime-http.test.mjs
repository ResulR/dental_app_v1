import { expect, test, vi } from "vitest";
import { createHash } from "node:crypto";
import pg from "pg";
import { createRuntime } from "../../apps/api/dist/app/runtime.js";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
const env = {
  DENTAL_LAB_AUTH_ENABLED: "true",
  DENTAL_LAB_REGISTRATION_ENABLED: "true",
  DENTAL_LAB_ORIGIN: "https://dental.example.test",
  DENTAL_LAB_SESSION_LIFETIME_MS: "60000",
  DENTAL_LAB_SESSION_ABSOLUTE_MS: "120000",
  DENTAL_LAB_LOGIN_WINDOW_MS: "10000",
  DENTAL_LAB_LOGIN_ACCOUNT_ATTEMPTS: "3",
  DENTAL_LAB_LOGIN_NETWORK_ATTEMPTS: "10",
  DENTAL_LAB_LOGIN_MAX_KEYS: "100",
};
const identity = {
  database: "dental_lab",
  identity: "dental-lab-runtime",
  session_identity: "dental-lab-runtime",
  version: 170011,
  administrative: false,
  db_create: false,
  db_temp: false,
  schema_create: false,
  forbidden_membership: false,
  app_membership: true,
  unexpected_membership: false,
  owned_objects: false,
};
test("configured runtime exposes verified terms only when explicitly enabled; PG transport doubled", async () => {
  for (const enabled of [false, true]) {
    const body = "Synthetic terms. Not approved legal text.";
    const query = vi.fn(async (sql) => {
      if (sql.includes("current_database()")) return { rows: [identity] };
      if (sql.includes("auth_readiness"))
        return {
          rows: [
            {
              readable: true,
              insertable: true,
              updatable: true,
              cleanup: true,
            },
          ],
        };
      if (sql.includes("registration_readiness"))
        return { rows: [{ ready: true }] };
      if (sql.includes("FROM public.registration_current_terms"))
        return {
          rows: [
            {
              version_id: "10000000-0000-4000-8000-000000000001",
              body,
              body_sha256: createHash("sha256").update(body).digest(),
              approved: true,
            },
          ],
        };
      throw new Error("UNEXPECTED_SQL");
    });
    const connect = vi
      .spyOn(pg.Pool.prototype, "connect")
      .mockResolvedValue({ query, release: vi.fn() });
    const end = vi.spyOn(pg.Pool.prototype, "end").mockResolvedValue();
    let runtime, server;
    try {
      runtime = await createRuntime({
        ...env,
        DENTAL_LAB_REGISTRATION_ENABLED: String(enabled),
      });
      server = createApp(runtime.registerRoutes, () => {}).listen(
        0,
        "127.0.0.1",
      );
      await new Promise((resolve) => server.once("listening", resolve));
      const response = await fetch(
        "http://127.0.0.1:" +
          server.address().port +
          "/api/v1/clinics/registration/terms",
      );
      expect(response.status).toBe(enabled ? 200 : 404);
      if (enabled) {
        expect(await response.json()).toMatchObject({ body });
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(response.headers.get("set-cookie")).toBeNull();
      }
      expect(
        query.mock.calls.some(([sql]) =>
          sql.includes("registration_readiness"),
        ),
      ).toBe(enabled);
      expect(
        query.mock.calls.every(
          ([sql]) => !/^(INSERT|UPDATE|DELETE|CREATE)/u.test(sql),
        ),
      ).toBe(true);
    } finally {
      if (server) await closeServer(server);
      if (runtime) await runtime.close();
      connect.mockRestore();
      end.mockRestore();
    }
  }
});
