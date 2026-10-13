import { expect, test } from "vitest";
import { reviewAuthConfig } from "../../scripts/auth-config-review.mjs";
const values = () => ({
  NODE_ENV: "production",
  DENTAL_LAB_PORT: "34567",
  DENTAL_LAB_AUTH_ENABLED: "true",
  DENTAL_LAB_ORIGIN: "https://lab.example.invalid",
  DENTAL_LAB_SESSION_LIFETIME_MS: "3600000",
  DENTAL_LAB_SESSION_ABSOLUTE_MS: "86400000",
  DENTAL_LAB_LOGIN_WINDOW_MS: "60000",
  DENTAL_LAB_LOGIN_ACCOUNT_ATTEMPTS: "5",
  DENTAL_LAB_LOGIN_NETWORK_ATTEMPTS: "20",
  DENTAL_LAB_LOGIN_MAX_KEYS: "1000",
  PGDATABASE: "dental_lab",
  PGHOST: "/var/run/postgresql",
  PGPORT: "5432",
  PGUSER: "dental-lab-runtime",
});
test("deployment review uses actual runtime validators and emits a public literal EnvironmentFile", () => {
  expect(reviewAuthConfig(values())).toContain("PGUSER=dental-lab-runtime\n");
  for (const change of [
    { PGUSER: "postgres" },
    { PGHOST: "elsewhere" },
    { PGPASSWORD: "forbidden" },
    { DENTAL_LAB_ORIGIN: "https://example.invalid\nINJECTION=yes" },
    { DENTAL_LAB_PORT: "0" },
    { DENTAL_LAB_AUTH_ENABLED: "false" },
    { DENTAL_LAB_LOGIN_MAX_KEYS: "1" },
    { DENTAL_LAB_SESSION_ABSOLUTE_MS: "1000" },
  ])
    expect(() => reviewAuthConfig({ ...values(), ...change })).toThrow();
});
