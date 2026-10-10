export type AppConfig = {
  mode: "development" | "test" | "production";
  host: "127.0.0.1";
  port: number;
};
export function readConfig(
  env: Readonly<Record<string, string | undefined>>,
): AppConfig {
  const mode = env.NODE_ENV ?? "development";
  if (!["development", "test", "production"].includes(mode))
    throw new Error("INVALID_CONFIG_NODE_ENV");
  const value = env.DENTAL_LAB_PORT;
  if (value === undefined || !/^(0|[1-9][0-9]{0,4})$/.test(value))
    throw new Error("INVALID_CONFIG_PORT");
  const port = Number(value);
  if (port > 65535 || (port === 0 && mode !== "test"))
    throw new Error("INVALID_CONFIG_PORT");
  if (env.DENTAL_LAB_HOST !== undefined && env.DENTAL_LAB_HOST !== "127.0.0.1")
    throw new Error("INVALID_CONFIG_HOST");
  if (env.PGDATABASE !== undefined && env.PGDATABASE !== "dental_lab")
    throw new Error("INVALID_CONFIG_DATABASE");
  return { mode: mode as AppConfig["mode"], host: "127.0.0.1", port };
}
