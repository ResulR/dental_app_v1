import { test, expect } from "@playwright/test";
import { SessionIdentitySchema } from "@dental-lab/contracts";
test("approved HTTPS session is browser-managed, private API uncached, targeted logout enforced", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Jeni të identifikuar" }),
  ).toBeVisible();
  const response = await context.request.get("/api/v1/auth/session");
  expect(response.status()).toBe(200);
  expect(SessionIdentitySchema.safeParse(await response.json()).success).toBe(
    true,
  );
  expect(response.headers()["cache-control"] === "no-store").toBe(true);
  const cookies = await context.cookies();
  const session = cookies.filter(
    (cookie) => cookie.name === "__Host-dental_session",
  );
  expect(session.length === 1).toBe(true);
  expect(
    session[0]?.secure === true &&
      session[0]?.httpOnly === true &&
      session[0]?.path === "/" &&
      session[0]?.sameSite === "Lax",
  ).toBe(true);
  // Boolean assertions avoid printing cookie values on failure.
  expect(
    await page.evaluate(
      () => !globalThis.document.cookie.includes("__Host-dental_session="),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(async () => {
      for (const name of await globalThis.caches.keys()) {
        if (!name.startsWith("dental-lab-shell-")) continue;
        const cache = await globalThis.caches.open(name);
        if (
          (await cache.keys()).some((request) =>
            new URL(request.url).pathname.startsWith("/api/"),
          )
        )
          return false;
      }
      return true;
    }),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Dil nga llogaria", exact: true })
    .click();
  await expect(page.getByLabel("Fjalëkalimi", { exact: true })).toBeVisible();
  expect((await context.request.get("/api/v1/auth/session")).status()).toBe(
    401,
  );
});
