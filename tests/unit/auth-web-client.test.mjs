import { expect, test, vi } from "vitest";
import {
  createAuthClient,
  authFailureMessage,
} from "../../apps/web/src/features/authentication/auth-api.ts";
const { Response, Headers } = globalThis;
const credentials = {
  email: "user@example.test",
  password: "synthetic-private-password",
};
const id = "10000000-0000-4000-8000-000000000001";
function problem(status, code, extra = {}) {
  return Response.json(
    {
      type: "/api/v1/problems/" + code.toLowerCase(),
      title: "Generic",
      status,
      code,
      request_id: "test",
      ...extra,
    },
    { status },
  );
}
test("web client uses reviewed relative endpoints, browser cookies and no-cache without token headers or storage", async () => {
  const transport = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(Response.json({ account_id: id, profile: "clinic" }))
    .mockResolvedValue(new Response(null, { status: 204 }));
  const client = createAuthClient(transport);
  expect(await client.login(credentials)).toEqual({ kind: "ok" });
  expect(await client.session()).toEqual({
    kind: "authenticated",
    identity: { account_id: id, profile: "clinic" },
  });
  await client.renew();
  await client.logout();
  await client.logoutAll();
  expect(transport.mock.calls.map(([path]) => path)).toEqual([
    "/api/v1/auth/login",
    "/api/v1/auth/session",
    "/api/v1/auth/renew",
    "/api/v1/auth/logout",
    "/api/v1/auth/logout-all",
  ]);
  for (const [path, options] of transport.mock.calls) {
    expect(path).not.toContain(credentials.password);
    expect(options).toMatchObject({
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
    });
    expect(options.headers).not.toHaveProperty("Cookie");
    expect(options.headers).not.toHaveProperty("Authorization");
    expect(options.headers).not.toHaveProperty("Origin");
  }
  expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual(credentials);
  expect(transport.mock.calls[1][1]).not.toHaveProperty("body");
  expect(transport.mock.calls[4][1].body).toBe("{}");
});
test("untrusted input and responses cannot smuggle identity or private upstream errors into UI", async () => {
  const transport = vi
    .fn()
    .mockResolvedValue(
      Response.json({ account_id: id, profile: "owner", password: "PRIVATE" }),
    );
  const client = createAuthClient(transport);
  expect(await client.login({ ...credentials, account_id: id })).toEqual({
    kind: "invalid",
  });
  expect(transport).not.toHaveBeenCalled();
  expect(await client.session()).toEqual({ kind: "unavailable" });
  transport.mockResolvedValueOnce(
    new Response("PRIVATE_DATABASE_ERROR", { status: 500 }),
  );
  const error = await client.login(credentials);
  expect(error).toEqual({ kind: "unavailable" });
  expect(authFailureMessage(error)).not.toContain("PRIVATE");
});
test("neutral denial, forbidden origin and bounded Retry-After have safe Albanian feedback", async () => {
  const transport = vi
    .fn()
    .mockResolvedValueOnce(problem(401, "AUTHENTICATION_REQUIRED"))
    .mockResolvedValueOnce(problem(403, "FORBIDDEN"))
    .mockResolvedValueOnce(problem(429, "RATE_LIMITED"));
  const client = createAuthClient(transport);
  expect(await client.session()).toEqual({ kind: "denied" });
  expect(await client.login(credentials)).toEqual({ kind: "forbidden" });
  const limited = await client.login(credentials);
  expect(limited).toEqual({ kind: "limited", retryAfterSeconds: 1 });
  expect(authFailureMessage(limited)).toContain("1 sekondash");
  for (const header of ["30", "900000000000000000000", "invalid"]) {
    const response = problem(429, "RATE_LIMITED");
    response.headers.set("Retry-After", header);
    transport.mockResolvedValueOnce(response);
    expect(await client.login(credentials)).toEqual({
      kind: "limited",
      retryAfterSeconds: header === "30" ? 30 : 1,
    });
  }
});
test("network failure/unknown success/status mismatch fail closed without automatic retry", async () => {
  const transport = vi
    .fn()
    .mockRejectedValueOnce(new Error("PRIVATE_NETWORK_ERROR"))
    .mockResolvedValueOnce(Response.json({ account_id: id, profile: "clinic" }))
    .mockResolvedValueOnce(problem(401, "FORBIDDEN"));
  const client = createAuthClient(transport);
  expect(await client.logout()).toEqual({ kind: "unavailable" });
  expect(transport).toHaveBeenCalledOnce();
  expect(await client.login(credentials)).toEqual({ kind: "unavailable" });
  expect(await client.session()).toEqual({ kind: "unavailable" });
});
test("requests including body decoding are abortable and bounded to eight seconds", async () => {
  vi.useFakeTimers();
  try {
    let signal;
    const transport = vi.fn(async (_path, options) => {
      signal = options.signal;
      return {
        status: 200,
        headers: new Headers(),
        json: () =>
          new Promise((_, reject) => {
            signal.addEventListener(
              "abort",
              () => reject(new Error("aborted body")),
              { once: true },
            );
          }),
      };
    });
    const pending = createAuthClient(transport).session();
    await vi.advanceTimersByTimeAsync(8000);
    expect(await pending).toEqual({ kind: "unavailable" });
    expect(signal.aborted).toBe(true);
    expect(transport).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});
