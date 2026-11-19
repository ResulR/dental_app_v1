import type { ServerDraft } from "./draft-sync-api.js";

// A list item is only a choice to inspect. Import requires the same server
// revision to avoid replacing local work with an unseen concurrent edit.
export function inspectDraftImport(
  selected: { draft_id: string; revision: string },
  snapshot: ServerDraft | null,
): "missing" | "changed" | "ready" {
  if (!snapshot || snapshot.draft_id !== selected.draft_id) return "missing";
  if (snapshot.revision !== selected.revision) return "changed";
  return snapshot.state === "active" && snapshot.payload ? "ready" : "changed";
}

export function canChangeLocalDraft(
  disabled: boolean,
  submissionState: "prepared" | "uncertain" | "settled" | null,
): boolean {
  return (
    !disabled &&
    submissionState !== "prepared" &&
    submissionState !== "uncertain"
  );
}
