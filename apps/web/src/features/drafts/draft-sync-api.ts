import {
  DraftCommitResultSchema,
  DraftListResultSchema,
  DraftSnapshotSchema,
} from "@dental-lab/contracts";

export type ServerDraft = ReturnType<typeof DraftSnapshotSchema.parse>;
type DraftList = ReturnType<typeof DraftListResultSchema.parse>;
export function mergeDraftListPage(
  previous: DraftList | null,
  incoming: DraftList,
  after?: string,
): DraftList | null {
  if (!after) return incoming;
  if (!previous || previous.next_after !== after) return previous;
  const known = new Set(previous.items.map((item) => item.draft_id));
  const additional = incoming.items.filter((item) => {
    if (known.has(item.draft_id)) return false;
    known.add(item.draft_id);
    return true;
  });
  return {
    items: [...previous.items, ...additional],
    next_after: incoming.next_after === after ? null : incoming.next_after,
  };
}
export type ServerDraftPayload = NonNullable<ServerDraft["payload"]>;
export type DraftCommand = {
  draft_id: string;
  expected_revision: number;
  idempotency_key: string;
  payload?: ServerDraftPayload;
};
async function request<T>(
  action: string,
  input: unknown,
  parse: (value: unknown) => T,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("/api/v1/drafts/" + action, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("DRAFT_SYNC_UNAVAILABLE");
    return parse(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}
export const listServerDrafts = (after?: string) =>
  request("list", after ? { after } : {}, (value) =>
    DraftListResultSchema.parse(value),
  );
export const readServerDraft = (draft_id: string) =>
  request("read", { draft_id }, (value) =>
    value === null ? null : DraftSnapshotSchema.parse(value),
  );
export const commitServerDraft = (command: DraftCommand) =>
  request("commit", command, (value) => DraftCommitResultSchema.parse(value));
