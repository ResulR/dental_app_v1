import { describe, expect, test } from "vitest";
import { allowed } from "../../scripts/check-boundaries.mjs";
describe("module import directions", () => {
  test.each([
    [
      "apps/web/src/shared/a.ts",
      "apps/web/src/features/orders/index.ts",
      false,
    ],
    [
      "apps/web/src/features/a/a.ts",
      "apps/web/src/features/b/internal.ts",
      false,
    ],
    ["apps/web/src/features/a/a.ts", "apps/web/src/features/b/index.ts", true],
    [
      "apps/api/src/modules/orders/routes.ts",
      "apps/api/src/modules/orders/repository.ts",
      false,
    ],
    [
      "apps/api/src/modules/orders/repository.ts",
      "apps/api/src/modules/orders/controller.ts",
      false,
    ],
    ["apps/api/src/app/a.ts", "apps/web/src/app/a.ts", false],
    ["packages/contracts/src/a.ts", "apps/api/src/app/a.ts", false],
    ["apps/web/src/app/a.ts", "apps/web/src/features/orders/index.ts", true],
  ])("%s -> %s: %s", (from, to, accepted) => {
    expect(allowed(from, to)).toBe(accepted);
  });
});
