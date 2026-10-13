import { expect, test, vi } from "vitest";
import { runAuthPostgresProbe } from "../../scripts/auth-postgres-probe.mjs";
test("real probe refuses active runtime, missing owner or used limiter before fixture writes", async () => {
  for (const denied of ["runtime", "owner", "limiter"]) {
    const statements = [];
    const database = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            readable: true,
            insertable: true,
            updatable: true,
            cleanup: true,
          },
        ],
      }),
      transaction: async (work) =>
        work({
          query: async (sql) => {
            statements.push(sql);
            if (sql.includes("pg_stat_activity"))
              return { rows: [{ count: denied === "runtime" ? 1 : 0 }] };
            if (sql.includes("public.owner_slot"))
              return { rows: [], rowCount: denied === "owner" ? 0 : 1 };
            if (sql.includes("policy_digest"))
              return {
                rows: [
                  {
                    policy_digest:
                      denied === "limiter" ? Buffer.alloc(32) : null,
                  },
                ],
              };
            throw new Error("UNEXPECTED_PROBE_SQL");
          },
        }),
    };
    await expect(runAuthPostgresProbe(database)).rejects.toThrow(
      "AUTH_POSTGRES_PROBE_FAILED",
    );
    expect(statements.some((sql) => sql.startsWith("INSERT"))).toBe(false);
  }
});
