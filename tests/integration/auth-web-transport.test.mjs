import { expect, test } from "vitest";
import { createAuthClient } from "../../apps/web/src/features/authentication/auth-api.ts";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import {
  createSessionService,
  registerAuthenticationRoutes,
} from "../../apps/api/dist/modules/identity/index.js";
const { Headers } = globalThis;
const accountId = "10000000-0000-4000-8000-000000000001";
const origin = "https://dental.example.test";
test("web transport consumes actual auth endpoints and cookies without exposing token in identity DTO", async () => {
  const records = new Map();
  let epoch = "1",
    sequence = 0;
  const store = {
    async find(hash) {
      const value = records.get(hash.toString("hex"));
      return value ? { ...value, currentAuthEpoch: epoch } : undefined;
    },
    async issue(write) {
      records.set(write.digest.toString("hex"), {
        id: String(++sequence),
        accountId,
        profile: "clinic",
        authEpoch: epoch,
        currentAuthEpoch: epoch,
        accountUsable: true,
        createdAt: write.createdAt,
        expiresAt: write.expiresAt,
        absoluteExpiresAt: write.absoluteExpiresAt,
        revokedAt: null,
      });
      return true;
    },
    async rotate(old, write) {
      const parent = [...records.values()].find(
        (record) => record.id === old.id,
      );
      if (!parent || parent.revokedAt !== null) return false;
      parent.revokedAt = Date.now();
      return this.issue(write);
    },
    async revokeOne(id, sessionId) {
      for (const record of records.values())
        if (record.accountId === id && record.id === sessionId)
          record.revokedAt = Date.now();
    },
    async revokeAll(id) {
      expect(id).toBe(accountId);
      epoch = String(Number(epoch) + 1);
    },
  };
  const authentication = {
    async authenticate(email, password) {
      return email === "user@example.test" && password === "synthetic-password"
        ? {
            kind: "authenticated",
            accountId,
            profile: "clinic",
            authEpoch: epoch,
          }
        : { kind: "denied" };
    },
  };
  const sessions = createSessionService(store, {
    lifetimeMs: 60000,
    absoluteLifetimeMs: 120000,
  });
  const server = createApp(
    (app) =>
      registerAuthenticationRoutes(app, { authentication, sessions, origin }),
    () => {},
  ).listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  let jar = "";
  try {
    const base = "http://127.0.0.1:" + server.address().port;
    const client = createAuthClient(async (path, options) => {
      const headers = new Headers(options.headers);
      if (options.method === "POST") headers.set("Origin", origin);
      if (jar) headers.set("Cookie", jar);
      const response = await fetch(base + path, { ...options, headers });
      const cookie = response.headers.get("set-cookie");
      if (cookie) jar = cookie.split(";")[0];
      return response;
    });
    expect(await client.session()).toEqual({ kind: "denied" });
    expect(
      await client.login({ email: "user@example.test", password: "wrong" }),
    ).toEqual({ kind: "denied" });
    expect(
      await client.login({
        email: "user@example.test",
        password: "synthetic-password",
      }),
    ).toEqual({ kind: "ok" });
    const identity = await client.session();
    expect(identity).toEqual({
      kind: "authenticated",
      identity: { account_id: accountId, profile: "clinic" },
    });
    expect(identity).not.toHaveProperty("token");
    expect(await client.renew()).toEqual({ kind: "ok" });
    expect(await client.logout()).toEqual({ kind: "ok" });
    expect(await client.session()).toEqual({ kind: "denied" });
    await client.login({
      email: "user@example.test",
      password: "synthetic-password",
    });
    expect(await client.logoutAll()).toEqual({ kind: "ok" });
    expect(await client.session()).toEqual({ kind: "denied" });
  } finally {
    await closeServer(server);
  }
});
