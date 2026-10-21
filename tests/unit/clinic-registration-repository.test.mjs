import { expect, test, vi } from "vitest";
import { createClinicRegistrationRepository } from "../../apps/api/dist/modules/clinics/index.js";
const version = "10000000-0000-4000-8000-000000000001";
const data = {
  name: "Fixture",
  dentist_first_name: "Test",
  dentist_last_name: "Only",
  email: "fixture@example.invalid",
  email_key: "fixture@example.invalid",
  phone: "+000",
  address: "Fixture",
  password_hash: "fixture-hash",
  terms_version_id: version,
  profile: "clinic",
  review_state: "pending",
};
function fixture(options = {}) {
  let committed = [];
  const statements = [];
  const query = vi.fn(async (sql, values) => {
    statements.push({ sql, values });
    if (options.failAt && sql.includes(options.failAt)) throw options.error;
    if (sql.startsWith("SELECT version_id"))
      return {
        rows: options.noTerms
          ? []
          : [{ version_id: options.version ?? version }],
      };
    if (sql.startsWith("SELECT a.id"))
      return { rows: options.noOwner ? [] : [{ id: "owner-fixture" }] };
    if (sql.startsWith("INSERT INTO public.conversations"))
      return {
        rows: options.noConversation ? [] : [{ id: version }],
        rowCount: 1,
      };
    return { rows: [], rowCount: 1 };
  });
  const transaction = vi.fn(async (work) => {
    const result = await work({ query });
    if (options.commitError) throw options.commitError;
    committed = [...statements];
    return result;
  });
  return {
    repository: createClinicRegistrationRepository({ query, transaction }),
    statements,
    query,
    transaction,
    committed: () => committed,
  };
}
test("registration composes conversation and paired read markers in one transaction after terms lock and owner recheck", async () => {
  const f = fixture();
  expect(await f.repository.registerAtomic(data)).toBe("created");
  expect(f.transaction).toHaveBeenCalledTimes(1);
  expect(f.statements[0].sql).toContain("FOR SHARE");
  expect(f.committed().filter((s) => s.sql.startsWith("INSERT"))).toHaveLength(
    9,
  );
  const values = f.statements.map((s) => s.values);
  const account = values[2][0],
    clinic = values[3][0],
    event = values[9][0];
  expect(values[3][1]).toBe(account);
  expect(values[4]).toEqual([account, data.password_hash]);
  expect(values[5]).toEqual([account, version]);
  expect(values[6]).toEqual([clinic]);
  expect(values[7]).toEqual([version]);
  expect(f.statements[7].sql).toContain("'clinic'),($1,'laboratory'");
  expect(values[8][0]).toBe(clinic);
  expect(values[9][1]).toBe(clinic);
  expect(values[9][2]).toBe(values[8][1]);
  expect(values[10]).toEqual([event]);
  expect(f.statements[2].sql).toContain("'clinic'");
  expect(f.statements[3].sql).toContain("'pending'");
  expect(f.statements.every((s) => !s.sql.includes(data.email))).toBe(true);
});
test("missing owner, missing terms and version race cannot write", async () => {
  for (const [options, expected] of [
    [{ noOwner: true }, "unavailable"],
    [{ noTerms: true }, "unavailable"],
    [{ version: "10000000-0000-4000-8000-000000000002" }, "terms_changed"],
  ]) {
    const f = fixture(options);
    expect(await f.repository.registerAtomic(data)).toBe(expected);
    expect(f.statements.some((s) => s.sql.startsWith("INSERT"))).toBe(false);
  }
});
test("failure at every write aborts the callback; no committed result or retry", async () => {
  for (const table of [
    "accounts",
    "clinics",
    "credentials",
    "clinic_terms_acceptances",
    "conversations",
    "conversation_reads",
    "audit_events",
    "outbox_events",
    "outbox_dispatches",
  ]) {
    const error = new Error("injected failure");
    const f = fixture({ failAt: "INSERT INTO public." + table + "(", error });
    await expect(f.repository.registerAtomic(data)).rejects.toBe(error);
    expect(f.committed()).toEqual([]);
    expect(f.transaction).toHaveBeenCalledTimes(1);
    expect(f.statements.at(-1).sql).toContain(
      "INSERT INTO public." + table + "(",
    );
  }
});
test("only email uniqueness is a duplicate; other 23505 and ambiguous commits propagate", async () => {
  const duplicate = { code: "23505", constraint: "accounts_email_key_key" };
  const f = fixture({
    failAt: "INSERT INTO public.accounts",
    error: duplicate,
  });
  expect(await f.repository.registerAtomic(data)).toBe("duplicate");
  expect(f.committed()).toEqual([]);
  for (const error of [
    { code: "23505", constraint: "other" },
    new Error("connection lost"),
  ]) {
    const g = fixture({ commitError: error });
    await expect(g.repository.registerAtomic(data)).rejects.toBe(error);
    expect(g.transaction).toHaveBeenCalledTimes(1);
  }
});
test("preflight reads report absence without creating an owner or publishing terms", async () => {
  const f = fixture({ noTerms: true, noOwner: true });
  expect(await f.repository.currentTermsVersion()).toBeUndefined();
  expect(await f.repository.ownerInitialized()).toBe(false);
  expect(f.transaction).not.toHaveBeenCalled();
  expect(f.statements.every((s) => s.sql.startsWith("SELECT"))).toBe(true);
});

test("missing conversation receipt aborts registration before read markers and audit", async () => {
  const f = fixture({ noConversation: true });
  await expect(f.repository.registerAtomic(data)).rejects.toThrow(
    "GENERAL_CONVERSATION_NOT_CREATED",
  );
  expect(f.committed()).toEqual([]);
  expect(
    f.statements.some((s) => s.sql.includes("public.conversation_reads")),
  ).toBe(false);
});
