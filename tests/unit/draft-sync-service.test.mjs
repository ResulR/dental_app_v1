import { expect, test, vi } from "vitest";
import { createHash } from "node:crypto";
import { createDraftSyncService } from "../../apps/api/dist/modules/drafts/index.js";
import { DraftMutationSchema } from "@dental-lab/contracts";

const actor = {
  accountId: "10000000-0000-4000-8000-000000000002",
  sessionId: "10000000-0000-4000-8000-000000000003",
};
const clinic = "20000000-0000-4000-8000-000000000001";
const input = {
  draft_id: "90000000-0000-4000-8000-000000000001",
  expected_revision: 0,
  idempotency_key: "90000000-0000-4000-8000-000000000002",
  payload: { description: "Synthetic draft" },
};
function fixture(overrides = {}) {
  const calls = [];
  const query = vi.fn(async (sql, values = []) => {
    calls.push([sql, values]);
    if (sql.includes('AS "sessionValid"'))
      return {
        rows: overrides.denied
          ? []
          : [
              {
                profile: "clinic",
                lifecycle: "active",
                securityLocked: false,
                resetRequired: false,
                sessionValid: true,
                ownerCurrent: false,
                clinicId: clinic,
                clinicSuspended: false,
                grants: [],
              },
            ],
      };
    if (sql.includes("review_state='approved'"))
      return { rows: overrides.denied ? [] : [{ id: clinic }] };
    if (sql.includes("FROM public.draft_sync_receipts WHERE"))
      return { rows: overrides.receipt ? [overrides.receipt] : [] };
    if (sql.includes("INSERT INTO public.drafts"))
      return { rows: overrides.conflict ? [] : [{ revision: "1" }] };
    if (sql.includes("FROM public.drafts d LEFT JOIN"))
      return { rows: overrides.readRows ?? [] };
    return { rows: [] };
  });
  return {
    service: createDraftSyncService({ transaction: (work) => work({ query }) }),
    calls,
    query,
  };
}
test("create is scoped, transactional, versioned and receipts are checked first", async () => {
  const { service, calls } = fixture();
  expect((await service.commit(actor, input)).value).toEqual({
    kind: "committed",
    revision: "1",
    replayed: false,
  });
  expect(calls[0][0]).toContain("FOR UPDATE");
  const insert = calls.find(([sql]) =>
    sql.includes("INSERT INTO public.drafts"),
  );
  expect(insert[0]).toContain("ON CONFLICT DO NOTHING");
  expect(insert[0]).toContain("public.draft_revisions");
  expect(insert[0]).toContain("public.draft_sync_receipts");
  expect(insert[1].slice(0, 3)).toEqual([
    input.draft_id,
    actor.accountId,
    clinic,
  ]);
});
test("replay compares fingerprint; changed payload and stale revision conflict", async () => {
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        input.draft_id,
        input.expected_revision,
        "save",
        input.payload,
      ]),
    )
    .digest();
  const receipt = {
    draft_id: input.draft_id,
    committed_revision: "1",
    payload_fingerprint: fingerprint,
  };
  const replay = fixture({ receipt });
  expect((await replay.service.commit(actor, input)).value).toEqual({
    kind: "committed",
    revision: "1",
    replayed: true,
  });
  expect(
    replay.calls.some(([sql]) => sql.includes("INSERT INTO public.drafts")),
  ).toBe(false);
  expect(
    (
      await fixture({ receipt }).service.commit(actor, {
        ...input,
        payload: { description: "Different" },
      })
    ).value,
  ).toEqual({ kind: "conflict" });
  expect(
    (await fixture({ conflict: true }).service.commit(actor, input)).value,
  ).toEqual({ kind: "conflict" });
});
test("denied clinic, foreign read and invalid inputs do not write", async () => {
  const denied = fixture({ denied: true });
  expect((await denied.service.commit(actor, input)).kind).toBe("denied");
  expect(
    denied.calls.some(([sql]) => sql.includes("INSERT INTO public.drafts")),
  ).toBe(false);
  const other = fixture();
  expect(
    (await other.service.read(actor, { draft_id: input.draft_id })).value,
  ).toBeNull();
  expect(
    other.calls.find(([sql]) =>
      sql.includes("FROM public.drafts d LEFT JOIN"),
    )[1],
  ).toEqual([input.draft_id, actor.accountId, clinic]);
  expect(
    (await other.service.commit(actor, { ...input, payload: undefined })).kind,
  ).toBe("invalid");
  expect(
    DraftMutationSchema.safeParse({
      ...input,
      payload: { ...input.payload, file_ids: [input.draft_id] },
    }).success,
  ).toBe(false);
});
test("list is bounded, paginated and scoped to the authenticated clinic", async () => {
  const ids = Array.from({ length: 51 }, (_, index) => ({
    draft_id: `90000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    revision: "1",
  }));
  const query = vi.fn(async (sql) => {
    if (sql.includes('AS "sessionValid"'))
      return {
        rows: [
          {
            profile: "clinic",
            lifecycle: "active",
            securityLocked: false,
            resetRequired: false,
            sessionValid: true,
            ownerCurrent: false,
            clinicId: clinic,
            clinicSuspended: false,
            grants: [],
          },
        ],
      };
    if (sql.includes("review_state='approved'"))
      return { rows: [{ id: clinic }] };
    if (sql.includes("ORDER BY id LIMIT 51")) return { rows: ids };
    return { rows: [] };
  });
  const service = createDraftSyncService({
    transaction: (work) => work({ query }),
  });
  const result = await service.list(actor, {});
  expect(result.value.items).toHaveLength(50);
  expect(result.value.next_after).toBe(ids[49].draft_id);
  expect(
    query.mock.calls.find(([sql]) => sql.includes("ORDER BY id LIMIT 51"))[1],
  ).toEqual([actor.accountId, clinic, null]);
});
test("delete copies prior version to a tombstone with a CAS guard", async () => {
  const deleted = { ...input, expected_revision: 1, payload: undefined };
  const query = vi.fn(async (sql) => {
    if (sql.includes('AS "sessionValid"'))
      return {
        rows: [
          {
            profile: "clinic",
            lifecycle: "active",
            securityLocked: false,
            resetRequired: false,
            sessionValid: true,
            ownerCurrent: false,
            clinicId: clinic,
            clinicSuspended: false,
            grants: [],
          },
        ],
      };
    if (sql.includes("review_state='approved'"))
      return { rows: [{ id: clinic }] };
    if (
      sql.includes("INSERT INTO public.draft_sync_receipts") &&
      sql.includes("'delete'")
    )
      return { rows: [{ revision: "2" }] };
    return { rows: [] };
  });
  const service = createDraftSyncService({
    transaction: (work) => work({ query }),
  });
  expect((await service.commit(actor, deleted)).value).toEqual({
    kind: "committed",
    revision: "2",
    replayed: false,
  });
  const sql = query.mock.calls.find(([text]) => text.includes("'delete'"))[0];
  expect(sql).toContain("state='active'");
  expect(sql).toContain("r.revision=c.revision-1");
});
