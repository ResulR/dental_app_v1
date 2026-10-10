import { expect, test } from "vitest";
import { readConfig } from "../../apps/api/dist/app/config.js";
test("explicit local port, no external database or binding", () => {
  expect(readConfig({ NODE_ENV: "test", DENTAL_LAB_PORT: "0" })).toEqual({
    mode: "test",
    host: "127.0.0.1",
    port: 0,
  });
  for (const env of [
    {},
    { DENTAL_LAB_PORT: "0" },
    { DENTAL_LAB_PORT: "65536" },
    { DENTAL_LAB_PORT: "12x" },
    { DENTAL_LAB_PORT: "123", DENTAL_LAB_HOST: "0.0.0.0" },
    { DENTAL_LAB_PORT: "123", PGDATABASE: "other" },
    { DENTAL_LAB_PORT: "123", NODE_ENV: "unknown" },
  ])
    expect(() => readConfig(env)).toThrow(/^INVALID_CONFIG_/);
});
