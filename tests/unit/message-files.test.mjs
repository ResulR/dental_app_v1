import { test, expect } from "vitest";
import { createMessageFilesService } from "../../apps/api/dist/modules/messaging/index.js";
const id = "91000000-0000-4000-8000-000000000001";
const other = "91000000-0000-4000-8000-000000000002";
const actor = { accountId: id, sessionId: id };
const input = { conversation_id: id, message_id: id, version_id: id };
// Synthetic result sets: no actual SQL/PG locks or storage are exercised.
function db(patch = {}) {
  const calls = [];
  const query = async (sql, values = []) => {
    calls.push([sql, values]);
    if (sql.startsWith("SELECT a.profile"))
      return {
        rows: patch.revoked
          ? []
          : [
              {
                profile: patch.profile ?? "clinic",
                lifecycle: "active",
                securityLocked: false,
                resetRequired: false,
                sessionValid: true,
                ownerCurrent: true,
                clinicId: id,
                clinicSuspended: false,
                grants: patch.grants ?? [],
              },
            ],
      };
    if (sql.startsWith("SELECT id FROM public.clinics WHERE account_id=$1 AND"))
      return { rows: patch.unapproved ? [] : [{ id }] };
    if (sql.startsWith("SELECT id,clinic_id,kind FROM public.conversations"))
      return {
        rows: patch.foreign
          ? []
          : [{ id, clinic_id: id, kind: patch.kind ?? "order" }],
      };
    if (sql.startsWith("SELECT id FROM public.messages WHERE"))
      return { rows: patch.hidden || patch.stale ? [] : [{ id }] };
    if (sql.includes("FROM public.message_version_files"))
      return { rows: patch.files ?? [] };
    return { rows: [] };
  };
  return { calls, transaction: async (fn) => fn({ query }) };
}
test("current version metadata is scoped and contains no storage pointer or download", async () => {
  const source = db({
    files: [
      { id, filename: "Restauration.stl", format: "stl", size_bytes: "23" },
    ],
  });
  const result = await createMessageFilesService(source).list(actor, input);
  expect(result).toMatchObject({
    kind: "page",
    page: {
      version_id: id,
      items: [{ id, filename: "Restauration.stl", size_bytes: 23 }],
      next_after: null,
      download_available: false,
    },
  });
  expect(JSON.stringify(result)).not.toMatch(
    /object_key|content_sha256|storage_path/,
  );
  const scopes = source.calls.find(([sql]) =>
    sql.includes("FROM public.message_version_files"),
  );
  expect(scopes[1]).toEqual([id, id, null, id]);
  expect(scopes[0]).toContain("f.state='ready'");
  expect(scopes[0]).toContain("message_versions v");
  const parent = source.calls.find(([sql]) =>
    sql.startsWith("SELECT id FROM public.messages WHERE"),
  );
  expect(parent[1]).toEqual([id, id, id, id]);
});
test("revoked, foreign, hidden, stale and missing read permissions cannot enumerate files", async () => {
  for (const patch of [
    { revoked: true },
    { unapproved: true },
    { foreign: true },
    { hidden: true },
    { stale: true },
    { profile: "employee", grants: ["files.view"] },
    { profile: "employee", grants: ["messaging.order.read"] },
    {
      profile: "employee",
      kind: "general",
      grants: ["files.view", "orders.read_logistics", "messaging.order.read"],
    },
  ]) {
    const source = db(patch);
    expect(
      (await createMessageFilesService(source).list(actor, input)).kind,
    ).toBe("denied");
    expect(
      source.calls.some(([sql]) =>
        sql.includes("FROM public.message_version_files"),
      ),
    ).toBe(false);
  }
  const valid = db({
    profile: "employee",
    grants: ["files.view", "orders.read_logistics", "messaging.order.read"],
  });
  expect(
    (
      await createMessageFilesService(valid).list(actor, {
        ...input,
        after: other,
      })
    ).kind,
  ).toBe("page");
  expect(
    valid.calls.find(([sql]) =>
      sql.includes("FROM public.message_version_files"),
    )[1][2],
  ).toBe(other);
  const invalid = db();
  expect(
    (
      await createMessageFilesService(invalid).list(actor, {
        ...input,
        clinic_id: other,
      })
    ).kind,
  ).toBe("invalid");
  expect(invalid.calls).toHaveLength(0);
});
