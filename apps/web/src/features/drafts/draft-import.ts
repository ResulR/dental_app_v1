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

// Compare the exact server representation, not a revision counter alone.
// The caller only uses this before creating a new sync intention; an existing
// pending intention must always remain replayable with its original payload.
export function savedFormMatchesVisible<T>(
  saved: T,
  visible: T,
  toServer: (value: T) => unknown | null,
): boolean {
  const stored = toServer(saved);
  const current = toServer(visible);
  return (
    stored !== null &&
    current !== null &&
    JSON.stringify(stored) === JSON.stringify(current)
  );
}

export function conflictStateLabel(
  state: "active" | "deleted" | "submitted" | "missing",
) {
  return {
    active: "aktiv",
    deleted: "i fshirë",
    submitted: "i dërguar si porosi",
    missing: "i padisponueshëm",
  }[state];
}

export function serverChoiceConfirmation(
  state: "active" | "deleted" | "submitted",
) {
  return state === "active"
    ? "Versioni i serverit do të zëvendësojë draftin lokal të koduar. Vazhdoni?"
    : "Versioni i serverit është fshirë ose dërguar si porosi. Zgjedhja e tij do të heqë draftin lokal të koduar në këtë pajisje. Mund të ruani një kopje të re lokale në vend të kësaj. Vazhdoni?";
}
