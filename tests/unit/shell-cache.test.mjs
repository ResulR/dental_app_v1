import { expect, test } from "vitest";
import { isPublicShellRequest } from "../../scripts/shell-cache-policy.mjs";
test("only explicit public shell assets; private APIs, files, queries and external origins bypass cache", () => {
  const origin = "https://dental.invalid";
  const assets = ["/index.html", "/assets/app-abc.js", "/icon-192.png"];
  expect(isPublicShellRequest(origin + "/", "GET", origin, assets)).toBe(true);
  expect(
    isPublicShellRequest(origin + "/assets/app-abc.js", "GET", origin, assets),
  ).toBe(true);
  for (const pathname of [
    "/api/orders",
    "/files/example.stl",
    "/drafts",
    "/?token=synthetic",
    "/assets/app-abc.js?account=synthetic",
  ]) {
    expect(isPublicShellRequest(origin + pathname, "GET", origin, assets)).toBe(
      false,
    );
  }
  expect(
    isPublicShellRequest(
      "https://other.invalid/index.html",
      "GET",
      origin,
      assets,
    ),
  ).toBe(false);
  expect(
    isPublicShellRequest(origin + "/index.html", "POST", origin, assets),
  ).toBe(false);
});
