import { expect, test } from "vitest";
import {
  currentRequestCorrelation,
  withRequestCorrelation,
} from "../../apps/api/dist/shared/request-correlation.js";
test("concurrent asynchronous requests keep their own server correlation and no value escapes outside", async () => {
  function request(id) {
    return new Promise((resolve, reject) => {
      withRequestCorrelation(id, () => {
        Promise.resolve()
          .then(() => currentRequestCorrelation())
          .then(resolve, reject);
      });
    });
  }
  expect(
    await Promise.all([
      request("10000000-0000-4000-8000-000000000001"),
      request("10000000-0000-4000-8000-000000000002"),
    ]),
  ).toEqual([
    "10000000-0000-4000-8000-000000000001",
    "10000000-0000-4000-8000-000000000002",
  ]);
  expect(currentRequestCorrelation()).toMatch(/^[a-f0-9-]{36}$/);
  expect(currentRequestCorrelation()).not.toBe(currentRequestCorrelation());
});
