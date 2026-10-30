import {
  DraftCommitResultSchema,
  DraftListResultSchema,
  DraftSnapshotSchema,
} from "@dental-lab/contracts";

export type ServerDraft = ReturnType<typeof DraftSnapshotSchema.parse>;
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
