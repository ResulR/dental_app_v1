import { expect, test, vi } from "vitest";
import pg from "pg";
import { readAuthConfig } from "../../apps/api/dist/app/auth-config.js";
import { createRuntime } from "../../apps/api/dist/app/runtime.js";
const env = {
  DENTAL_LAB_AUTH_ENABLED: "true",
  DENTAL_LAB_ORIGIN: "https://dental.example.test",
  DENTAL_LAB_SESSION_LIFETIME_MS: "60000",
  DENTAL_LAB_SESSION_ABSOLUTE_MS: "120000",
  DENTAL_LAB_LOGIN_WINDOW_MS: "10000",
  DENTAL_LAB_LOGIN_ACCOUNT_ATTEMPTS: "3",
  DENTAL_LAB_LOGIN_NETWORK_ATTEMPTS: "10",
  DENTAL_LAB_LOGIN_MAX_KEYS: "100",
};
test("auth activation requires explicit bounded policies and exact HTTPS origin", () => {
  expect(readAuthConfig({})).toBeNull();
  expect(readAuthConfig({ DENTAL_LAB_AUTH_ENABLED: "false" })).toBeNull();
  expect(readAuthConfig(env)).toMatchObject({
    session: { lifetimeMs: 60000, absoluteLifetimeMs: 120000 },
    loginLimit: { maxKeys: 100 },
  });
  for (const patch of [
    { DENTAL_LAB_AUTH_ENABLED: "1" },
    { DENTAL_LAB_ORIGIN: "http://dental.example.test" },
    { DENTAL_LAB_ORIGIN: "https://dental.example.test/" },
    { DENTAL_LAB_ORIGIN: "https://user@dental.example.test" },
    { DENTAL_LAB_SESSION_ABSOLUTE_MS: "50000" },
    { DENTAL_LAB_LOGIN_MAX_KEYS: "100001" },
    { DENTAL_LAB_LOGIN_WINDOW_MS: undefined },
    { DENTAL_LAB_LOGIN_ACCOUNT_ATTEMPTS: "1e3" },
  ])
    expect(() => readAuthConfig({ ...env, ...patch })).toThrow();
});
test("disabled auth opens no pool connection; invalid/missing schema startup closes pool", async () => {
  const connect = vi.spyOn(pg.Pool.prototype, "connect");
  const end = vi.spyOn(pg.Pool.prototype, "end").mockResolvedValue();
  try {
    const disabled = await createRuntime({});
    expect(disabled.registerRoutes).toBeUndefined();
    await disabled.close();
    expect(connect).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
    const release = vi.fn();
    connect.mockResolvedValue({
      release,
      query: vi.fn().mockRejectedValue(new Error("missing prerequisites")),
    });
    await expect(createRuntime(env)).rejects.toThrow("missing prerequisites");
    expect(release).toHaveBeenCalledExactlyOnceWith(true);
    expect(end).toHaveBeenCalledOnce();
  } finally {
    connect.mockRestore();
    end.mockRestore();
  }
});
