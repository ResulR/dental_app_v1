import { expect, test, vi } from "vitest";
import {
  assertAuthStorageReady,
  authReadinessSql,
} from "../../apps/api/dist/modules/identity/auth-readiness.js";
test("startup requires all auth read/write/lock and owner alert privileges, never mutates schema", async () => {
  const ready = {
    readable: true,
    insertable: true,
    updatable: true,
    cleanup: true,
  };
  const query = vi.fn().mockResolvedValue({ rows: [ready] });
  await expect(assertAuthStorageReady({ query })).resolves.toBeUndefined();
  for (const flag of Object.keys(ready)) {
    query.mockResolvedValueOnce({ rows: [{ ...ready, [flag]: false }] });
    await expect(assertAuthStorageReady({ query })).rejects.toThrow(
      "AUTH_STORAGE_NOT_READY",
    );
  }
  query.mockResolvedValueOnce({ rows: [] });
  await expect(assertAuthStorageReady({ query })).rejects.toThrow(
    "AUTH_STORAGE_NOT_READY",
  );
  expect(authReadinessSql).toContain("public.notification_deliveries");
  expect(authReadinessSql).toContain("'auth_epoch','UPDATE'");
  expect(authReadinessSql).toContain("'public.login_attempt_limits','DELETE'");
  expect(authReadinessSql).not.toMatch(/GRANT|CREATE|ALTER/);
});
