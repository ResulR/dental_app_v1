import { expect, test, vi } from "vitest";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import {
  createAuthenticationService,
  createSessionService,
  registerAuthenticationRoutes,
  createLoginLimiter,
} from "../../apps/api/dist/modules/identity/index.js";
const accountId = "10000000-0000-4000-8000-000000000001";
const origin = "https://dental.example.test";
async function setup() {
  let at = 1800000000000,
    epoch = "1",
    sequence = 0,
    failIssue = false,
    failFind = false;
  const records = new Map(),
    networks = [];
  const store = {
    async find(hash) {
      if (failFind) throw new Error("PRIVATE_DATABASE_MARKER");
      const record = records.get(hash.toString("hex"));
      return record ? { ...record, currentAuthEpoch: epoch } : undefined;
    },
    async issue(input) {
      if (failIssue) throw new Error("PRIVATE_DATABASE_MARKER");
      if (input.fact.authEpoch !== epoch) return false;
      records.set(input.digest.toString("hex"), {
        id: String(++sequence),
        accountId,
        profile: "employee",
        authEpoch: epoch,
        currentAuthEpoch: epoch,
        accountUsable: true,
        createdAt: input.createdAt,
        expiresAt: input.expiresAt,
        absoluteExpiresAt: input.absoluteExpiresAt,
        revokedAt: null,
      });
      return true;
    },
    async rotate(old, input) {
      const record = [...records.values()].find((r) => r.id === old.id);
      if (!record || record.revokedAt !== null) return false;
      record.revokedAt = at;
      return this.issue(input);
    },
    async revokeOne(id, session) {
      for (const r of records.values())
        if (r.accountId === id && r.id === session) r.revokedAt = at;
    },
    async revokeAll(id) {
      expect(id).toBe(accountId);
      epoch = String(Number(epoch) + 1);
    },
  };
  const limiter = createLoginLimiter(
    { windowMs: 10000, accountAttempts: 20, networkAttempts: 20, maxKeys: 100 },
    () => at,
  );
  const verify = vi.fn(
    async (password, hash) =>
      password === "synthetic-password" && hash === "synthetic-hash",
  );
  const authentication = createAuthenticationService({
    findCredential: async (key) =>
      key === "user@example.test"
        ? {
            id: accountId,
            profile: "employee",
            lifecycle: "active",
            security_locked: false,
            credential_reset_required: false,
            clinic_suspended: false,
            auth_epoch: epoch,
            password_hash: "synthetic-hash",
          }
        : undefined,
    admit: async (key, network) => {
      networks.push(network);
      return limiter.consume(key, network);
    },
    verify,
  });
  const sessions = createSessionService(
    store,
    { lifetimeMs: 10000, absoluteLifetimeMs: 20000 },
    () => at,
  );
  const logs = [];
  const server = createApp(
    (app) =>
      registerAuthenticationRoutes(app, { authentication, sessions, origin }),
    (entry) => logs.push(entry),
  ).listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const base = "http://127.0.0.1:" + server.address().port;
  return {
    logs,
    networks,
    verify,
    records,
    advance: (ms) => {
      at += ms;
    },
    failIssue: () => {
      failIssue = true;
    },
    failFind: () => {
      failFind = true;
    },
    async post(path, body = {}, cookie, extra = {}) {
      return fetch(base + "/api/v1/auth/" + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          ...(cookie ? { Cookie: cookie } : {}),
          ...extra,
        },
        body: JSON.stringify(body),
      });
    },
    get: (cookie) =>
      fetch(base + "/api/v1/auth/session", {
        headers: cookie ? { Cookie: cookie } : {},
      }),
    close: () => closeServer(server),
  };
}
const credentials = {
  email: "user@example.test",
  password: "synthetic-password",
};
const cookie = (response) => response.headers.get("set-cookie")?.split(";")[0];
test("HTTP login, two devices, rotation, logout and global revocation use actual composed services", async () => {
  const f = await setup();
  try {
    expect((await f.get()).status).toBe(401);
    const login = await f.post("login", credentials);
    expect(login.status).toBe(204);
    const first = cookie(login);
    expect(login.headers.get("set-cookie")).toContain(
      "Secure; HttpOnly; SameSite=Lax",
    );
    expect(login.headers.get("set-cookie")).toMatch(/^__Host-dental_session=/);
    expect(login.headers.get("cache-control")).toBe("no-store");
    const second = cookie(await f.post("login", credentials));
    expect(second).not.toBe(first);
    expect(await (await f.get(first)).json()).toEqual({
      account_id: accountId,
      profile: "employee",
    });
    f.advance(6000);
    const renewal = await f.post("renew", {}, first);
    const rotated = cookie(renewal);
    expect(renewal.status).toBe(204);
    expect((await f.get(first)).status).toBe(401);
    expect((await f.get(rotated)).status).toBe(200);
    expect(
      (await f.post("logout", {}, rotated)).headers.get("set-cookie"),
    ).toContain("Max-Age=0");
    expect((await f.get(rotated)).status).toBe(401);
    expect((await f.get(second)).status).toBe(200);
    const third = cookie(await f.post("login", credentials));
    expect((await f.post("logout-all", {}, second)).status).toBe(204);
    expect((await f.get(second)).status).toBe(401);
    expect((await f.get(third)).status).toBe(401);
    expect(JSON.stringify(f.logs)).not.toContain("synthetic-password");
    expect(JSON.stringify(f.logs)).not.toContain(first.split("=")[1]);
  } finally {
    await f.close();
  }
});
test("mutations reject foreign/missing origin, injected IDs, wrong content type and duplicate cookies", async () => {
  const f = await setup();
  try {
    for (const supplied of ["https://foreign.example.test", "null", ""])
      expect(
        (await f.post("login", credentials, undefined, { Origin: supplied }))
          .status,
      ).toBe(403);
    expect(f.verify).not.toHaveBeenCalled();
    expect(
      (await f.post("login", { ...credentials, profile: "owner" })).status,
    ).toBe(400);
    expect(
      (
        await f.post("login", credentials, undefined, {
          "Content-Type": "text/plain",
        })
      ).status,
    ).toBe(400);
    const token = cookie(
      await f.post("login", credentials, undefined, {
        "X-Forwarded-For": "attacker-chosen",
      }),
    );
    expect(f.networks[0]).toBe("127.0.0.1");
    expect((await f.get(token + "; " + token)).status).toBe(401);
    expect(
      (await f.post("logout-all", { account_id: accountId }, token)).status,
    ).toBe(400);
    expect((await f.get(token)).status).toBe(200);
  } finally {
    await f.close();
  }
});
test("unknown account and bad password share neutral denial; limiter returns Retry-After", async () => {
  const f = await setup();
  try {
    const bad = await f.post("login", { ...credentials, password: "wrong" });
    const absent = await f.post("login", {
      ...credentials,
      email: "absent@example.test",
    });
    expect(bad.status).toBe(401);
    expect(absent.status).toBe(401);
    const a = await bad.json(),
      b = await absent.json();
    delete a.request_id;
    delete b.request_id;
    expect(a).toEqual(b);
    for (let i = 0; i < 18; i++)
      await f.post("login", { ...credentials, password: "wrong" });
    const limited = await f.post("login", credentials);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("10");
    expect(limited.headers.get("set-cookie")).toBeNull();
  } finally {
    await f.close();
  }
});
test("failed persistence emits no cookie, database failures are generic, no automatic retry", async () => {
  const f = await setup();
  try {
    f.failIssue();
    const failed = await f.post("login", credentials);
    expect(failed.status).toBe(500);
    expect(failed.headers.get("set-cookie")).toBeNull();
    expect(await failed.text()).not.toContain("PRIVATE_DATABASE_MARKER");
    expect(f.verify).toHaveBeenCalledOnce();
  } finally {
    await f.close();
  }
});
