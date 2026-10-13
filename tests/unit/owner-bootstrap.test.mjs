import { expect, test, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  provisionFirstOwner,
  validateApproval,
  validatePrepared,
} from "../../scripts/owner-bootstrap-core.mjs";

const approval = () => ({
  purpose: "first-owner-v1",
  approvalId: randomUUID(),
  email: "Owner+approved@EXAMPLE.invalid",
  expiresAt: Date.now() + 300000,
});
const prepared = () => ({
  approval: approval(),
  passwordHash: [
    "scrypt",
    "1",
    "131072",
    "8",
    "1",
    Buffer.alloc(16).toString("base64url"),
    Buffer.alloc(32).toString("base64url"),
  ].join("$"),
});
function client(options = {}) {
  const calls = [];
  return {
    calls,
    query: async (sql, values) => {
      calls.push({ sql, values });
      if (
        options.fail === "COMMIT"
          ? sql === "COMMIT"
          : options.fail && sql.includes(options.fail)
      )
        throw new Error("PRIVATE_DATABASE_DETAIL");
      if (sql.includes("current_database()"))
        return { rows: [{ safe: options.identity !== false }] };
      if (sql.includes("auth_readiness"))
        return {
          rows: [
            {
              readable: true,
              insertable: true,
              updatable: true,
              cleanup: options.ready !== false,
            },
          ],
        };
      if (sql.includes("has_any_column_privilege"))
        return { rows: [{ safe: options.acl !== false }] };
      if (sql.includes("AS empty"))
        return { rows: [{ empty: options.empty !== false }] };
      if (sql.includes("AS valid"))
        return { rows: [{ valid: options.valid !== false }] };
      return { rows: [], rowCount: 1 };
    },
  };
}
test("bootstrap binds approved email, fixed owner profile and authority to one checked commit", async () => {
  const db = client(),
    input = prepared();
  const result = await provisionFirstOwner(db, input);
  expect(result.outcome).toBe("committed");
  expect(result.approvalId).toBe(input.approval.approvalId);
  const account = db.calls.find((c) =>
    c.sql.startsWith("INSERT INTO public.accounts"),
  );
  expect(account.values).toEqual([
    result.accountId,
    input.approval.email,
    "Owner+approved@example.invalid",
  ]);
  expect(account.sql).toContain("'owner'");
  expect(
    db.calls.findIndex((c) => c.sql.startsWith("LOCK TABLE")),
  ).toBeLessThan(db.calls.indexOf(account));
  expect(db.calls.at(-1).sql).toBe("COMMIT");
  expect(
    db.calls.some((c) => /^(UPDATE|DELETE|GRANT|ALTER|CREATE)/.test(c.sql)),
  ).toBe(false);
  expect(db.calls.every((c) => !c.sql.includes(input.passwordHash))).toBe(true);
  expect(db.calls.filter((c) => c.sql.includes("password_hash")).length).toBe(
    1,
  );
});
test("bootstrap refuses malformed, expired, unbound or extended authorizations before SQL", async () => {
  for (const change of [
    { expiresAt: Date.now() - 1 },
    { expiresAt: Date.now() + 7200000 },
    { purpose: "transfer-owner" },
    { email: "invalid" },
    { approvalId: "not-an-approval" },
    { profile: "admin" },
  ]) {
    const db = client(),
      value = prepared();
    Object.assign(value.approval, change);
    await expect(provisionFirstOwner(db, value)).rejects.toThrow(
      "BOOTSTRAP_APPROVAL_INVALID",
    );
    expect(db.calls).toEqual([]);
  }
  expect(() =>
    validateApproval({ ...approval(), email: " owner@example.invalid" }),
  ).toThrow();
  expect(() =>
    validatePrepared({ ...prepared(), passwordHash: "invalid" }),
  ).toThrow("BOOTSTRAP_INPUT_INVALID");
  expect(() =>
    validatePrepared({ ...prepared(), accountId: randomUUID() }),
  ).toThrow("BOOTSTRAP_INPUT_INVALID");
});
test("existing state, unsafe identity/ACL/readiness or postcondition cannot commit", async () => {
  for (const options of [
    { empty: false },
    { identity: false },
    { acl: false },
    { ready: false },
    { valid: false },
  ]) {
    const db = client(options);
    await expect(provisionFirstOwner(db, prepared())).rejects.toThrow(
      "BOOTSTRAP_REFUSED_OR_ROLLED_BACK",
    );
    expect(db.calls.at(-1).sql).toBe("ROLLBACK");
    expect(db.calls.some((c) => c.sql === "COMMIT")).toBe(false);
    if (!("valid" in options))
      expect(db.calls.some((c) => c.sql.startsWith("INSERT"))).toBe(false);
  }
});
test("each partial write and deferred constraint failure rolls back and hides database details", async () => {
  for (const fail of [
    "INSERT INTO public.accounts",
    "INSERT INTO public.owner_slot",
    "INSERT INTO public.credentials",
    "INSERT INTO public.audit_events",
    "SET CONSTRAINTS ALL IMMEDIATE",
  ]) {
    const db = client({ fail });
    await expect(provisionFirstOwner(db, prepared())).rejects.toThrow(
      /^BOOTSTRAP_REFUSED_OR_ROLLED_BACK$/,
    );
    expect(db.calls.at(-1).sql).toBe("ROLLBACK");
    expect(db.calls.some((c) => c.sql === "COMMIT")).toBe(false);
  }
});
test("lost commit acknowledgement is uncertain and is never retried or announced rolled back", async () => {
  const db = client({ fail: "COMMIT" });
  await expect(provisionFirstOwner(db, prepared())).rejects.toThrow(
    "BOOTSTRAP_COMMIT_UNCERTAIN",
  );
  expect(db.calls.filter((c) => c.sql === "COMMIT")).toHaveLength(1);
  expect(db.calls.at(-1).sql).toBe("COMMIT");
  expect(db.calls.some((c) => c.sql === "ROLLBACK")).toBe(false);
});

test("rollback failure is uncertain; expiry during lock wait cannot write", async () => {
  const db = client({ empty: false });
  const query = db.query;
  db.query = (sql, values) => {
    if (sql === "ROLLBACK") throw new Error("PRIVATE_ROLLBACK_DETAIL");
    return query(sql, values);
  };
  await expect(provisionFirstOwner(db, prepared())).rejects.toThrow(
    "BOOTSTRAP_ROLLBACK_UNCERTAIN",
  );
  const second = client();
  const original = second.query;
  const input = prepared();
  const clock = vi.spyOn(Date, "now");
  second.query = (sql, values) => {
    if (sql.startsWith("LOCK TABLE"))
      clock.mockReturnValue(input.approval.expiresAt + 1);
    return original(sql, values);
  };
  try {
    await expect(provisionFirstOwner(second, input)).rejects.toThrow(
      "BOOTSTRAP_REFUSED_OR_ROLLED_BACK",
    );
    expect(second.calls.some((c) => c.sql.startsWith("INSERT"))).toBe(false);
    expect(second.calls.at(-1).sql).toBe("ROLLBACK");
  } finally {
    clock.mockRestore();
  }
});
