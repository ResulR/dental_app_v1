import { expect, test } from "vitest";
import {
  canChangeLocalDraft,
  inspectDraftImport,
  savedFormMatchesVisible,
} from "../../apps/web/src/features/drafts/draft-import.ts";
const id = "90000000-0000-4000-8000-000000000001";
const other = "90000000-0000-4000-8000-000000000002";
const selected = { draft_id: id, revision: "2" };
const snapshot = {
  ...selected,
  state: "active",
  payload: { description: "Synthétique" },
};
test("another device's revision is surfaced before importing into the local vault", () => {
  expect(inspectDraftImport(selected, snapshot)).toBe("ready");
  expect(inspectDraftImport(selected, { ...snapshot, revision: "3" })).toBe(
    "changed",
  );
  expect(
    inspectDraftImport(selected, {
      ...snapshot,
      state: "submitted",
      payload: null,
    }),
  ).toBe("changed");
  expect(inspectDraftImport(selected, { ...snapshot, draft_id: other })).toBe(
    "missing",
  );
  expect(inspectDraftImport(selected, null)).toBe("missing");
});
test("a pending or uncertain order submission freezes local draft replacements", () => {
  expect(canChangeLocalDraft(false, null)).toBe(true);
  expect(canChangeLocalDraft(false, "settled")).toBe(true);
  for (const state of ["prepared", "uncertain"])
    expect(canChangeLocalDraft(false, state)).toBe(false);
  expect(canChangeLocalDraft(true, null)).toBe(false);
});

test("a new sync cannot silently send an older saved form while preserving pending replay", () => {
  const toServer = (value) =>
    value.description ? { description: value.description } : null;
  expect(
    savedFormMatchesVisible(
      { description: "A" },
      { description: "A" },
      toServer,
    ),
  ).toBe(true);
  expect(
    savedFormMatchesVisible(
      { description: "A" },
      { description: "B" },
      toServer,
    ),
  ).toBe(false);
  expect(
    savedFormMatchesVisible(
      { description: "A" },
      { description: "" },
      toServer,
    ),
  ).toBe(false);
});
