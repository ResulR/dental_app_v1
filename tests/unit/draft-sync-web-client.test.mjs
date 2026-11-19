import { afterEach, expect, test, vi } from "vitest";
import {
  commitServerDraft,
  listServerDrafts,
  mergeDraftListPage,
  readServerDraft,
} from "../../apps/web/src/features/drafts/draft-sync-api.ts";
afterEach(() => vi.unstubAllGlobals());
const id = "90000000-0000-4000-8000-000000000001";
test("manual draft pagination preserves a newer list and deduplicates overlapping rows", () => {
  const item = (draft_id) => ({ draft_id, revision: "1" });
  const first = { items: [item("a"), item("b")], next_after: "b" };
  const next = { items: [item("b"), item("c")], next_after: null };
  expect(
    mergeDraftListPage(first, next, "b")?.items.map((row) => row.draft_id),
  ).toEqual(["a", "b", "c"]);
  const latest = { items: [item("z")], next_after: "z" };
  expect(mergeDraftListPage(latest, next, "b")).toBe(latest);
  expect(mergeDraftListPage(null, next, "b")).toBeNull();
  expect(mergeDraftListPage(first, latest)).toBe(latest);
  const repeated = mergeDraftListPage(
    first,
    {
      items: [item("c"), item("c")],
      next_after: "b",
    },
    "b",
  );
  expect(repeated.items.map((row) => row.draft_id)).toEqual(["a", "b", "c"]);
  expect(repeated.next_after).toBeNull();
});
test("manual API calls retain same intention, same-origin credentials and reject ambiguous responses", async () => {
  const transport = vi
    .fn()
    .mockResolvedValueOnce(
      new globalThis.Response(
        JSON.stringify({ kind: "committed", revision: "1", replayed: false }),
        { status: 200 },
      ),
    )
    .mockRejectedValueOnce(new Error("connection lost"))
    .mockResolvedValueOnce(
      new globalThis.Response(
        JSON.stringify({ kind: "committed", revision: "1", replayed: true }),
        { status: 200 },
      ),
    );
  vi.stubGlobal("fetch", transport);
  const command = {
    draft_id: id,
    expected_revision: 0,
    idempotency_key: "90000000-0000-4000-8000-000000000002",
    payload: { description: "Synthetic" },
  };
  expect((await commitServerDraft(command)).replayed).toBe(false);
  await expect(commitServerDraft(command)).rejects.toThrow("connection lost");
  expect((await commitServerDraft(command)).replayed).toBe(true);
  expect(transport).toHaveBeenCalledTimes(3);
  for (const [url, options] of transport.mock.calls) {
    expect(url).toBe("/api/v1/drafts/commit");
    expect(options.credentials).toBe("same-origin");
    expect(JSON.parse(options.body)).toEqual(command);
  }
});
test("malformed or unauthorized payload never becomes a draft", async () => {
  const transport = vi
    .fn()
    .mockResolvedValueOnce(
      new globalThis.Response(
        JSON.stringify({
          items: [{ draft_id: id, revision: "1" }],
          next_after: null,
        }),
        { status: 200 },
      ),
    )
    .mockResolvedValueOnce(
      new globalThis.Response(
        JSON.stringify({
          draft_id: id,
          revision: "1",
          state: "active",
          payload: { description: "Synthetic" },
        }),
        { status: 200 },
      ),
    )
    .mockResolvedValueOnce(
      new globalThis.Response(
        JSON.stringify({
          draft_id: id,
          revision: "1",
          state: "active",
          payload: { file_ids: [id] },
        }),
        { status: 200 },
      ),
    )
    .mockResolvedValueOnce(
      new globalThis.Response(JSON.stringify({ code: "FORBIDDEN" }), {
        status: 403,
      }),
    );
  vi.stubGlobal("fetch", transport);
  expect((await listServerDrafts()).items).toHaveLength(1);
  expect((await readServerDraft(id)).payload.description).toBe("Synthetic");
  await expect(readServerDraft(id)).rejects.toThrow();
  await expect(readServerDraft(id)).rejects.toThrow("DRAFT_SYNC_UNAVAILABLE");
});

test("delete intent can be replayed after an uncertain response without dropping its identity", async () => {
  const transport = vi
    .fn()
    .mockRejectedValueOnce(new Error("connection lost"))
    .mockResolvedValueOnce(
      new globalThis.Response(
        JSON.stringify({ kind: "committed", revision: "3", replayed: true }),
        { status: 200 },
      ),
    );
  vi.stubGlobal("fetch", transport);
  const command = {
    draft_id: id,
    expected_revision: 2,
    idempotency_key: "90000000-0000-4000-8000-000000000003",
  };
  await expect(commitServerDraft(command)).rejects.toThrow("connection lost");
  expect(await commitServerDraft(command)).toEqual({
    kind: "committed",
    revision: "3",
    replayed: true,
  });
  expect(
    transport.mock.calls.map(([, options]) => JSON.parse(options.body)),
  ).toEqual([command, command]);
});
