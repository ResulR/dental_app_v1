import { expect, test, vi } from "vitest";
import { createDraftRepository } from "../../apps/api/dist/modules/drafts/index.js";

const input = {
  draftId: "90000000-0000-4000-8000-000000000001",
  accountId: "10000000-0000-4000-8000-000000000002",
  clinicId: "20000000-0000-4000-8000-000000000001",
  expectedRevision: 1,
  schemaVersion: 1,
  payload: { description: "'; DELETE FROM public.drafts; --" },
  idempotencyKey: "fixture-intent",
  payloadFingerprint: new Uint8Array(32).fill(1),
};
test("one parameterized statement includes owner, CAS, history and receipt", async () => {
  const query = vi
    .fn()
    .mockResolvedValue({ rows: [{ draft_id: input.draftId, revision: "2" }] });
  const repository = createDraftRepository({ query });
  await expect(repository.save(input)).resolves.toEqual({
    draft_id: input.draftId,
    revision: "2",
  });
  expect(query).toHaveBeenCalledOnce();
  const [sql, values] = query.mock.calls[0];
  expect(sql).toContain("account_id=$2 AND clinic_id=$3");
  expect(sql).toContain("revision=$4 AND state='active'");
  expect(sql).toContain("public.draft_revisions");
  expect(sql).toContain("public.draft_sync_receipts");
  expect(sql).not.toContain(input.payload.description);
  expect(values.slice(0, 7)).toEqual([
    input.draftId,
    input.accountId,
    input.clinicId,
    1,
    1,
    JSON.stringify(input.payload),
    input.idempotencyKey,
  ]);
  expect(values[7]).toEqual(Buffer.from(input.payloadFingerprint));
});
test("no matching revision/scope returns no write result, no retry", async () => {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  await expect(
    createDraftRepository({ query }).save(input),
  ).resolves.toBeNull();
  expect(query).toHaveBeenCalledOnce();
});
test("invalid revision, schema or fingerprint rejected before SQL", async () => {
  const query = vi.fn();
  const repository = createDraftRepository({ query });
  for (const patch of [
    { expectedRevision: 0 },
    { expectedRevision: Number.MAX_SAFE_INTEGER },
    { expectedRevision: 1.5 },
    { schemaVersion: 0 },
    { schemaVersion: 2147483648 },
    { payloadFingerprint: new Uint8Array(31) },
    { idempotencyKey: " " },
  ])
    await expect(repository.save({ ...input, ...patch })).rejects.toThrow(
      "INVALID_DRAFT_SAVE",
    );
  expect(query).not.toHaveBeenCalled();
});
test("unique receipt conflict and SQL failure propagated without blind retry", async () => {
  const conflict = Object.assign(new Error("fixture conflict"), {
    code: "23505",
  });
  const query = vi.fn().mockRejectedValue(conflict);
  await expect(createDraftRepository({ query }).save(input)).rejects.toBe(
    conflict,
  );
  expect(query).toHaveBeenCalledOnce();
});
