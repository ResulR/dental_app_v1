import { test, expect } from "vitest";
import { evaluateReleaseState } from "../../scripts/check-release-candidate.mjs";

const head = "a".repeat(40);
const clean = { branch: "main", head, upstream: head, status: "" };

test("requires an identified, clean local main candidate", () => {
  expect(evaluateReleaseState(clean, head)).toEqual({ head, branch: "main" });
  for (const candidate of [
    { ...clean, branch: "feature" },
    { ...clean, upstream: "b".repeat(40) },
    { ...clean, status: "?? private.txt" },
    { ...clean, head: "invalid" },
  ])
    expect(() => evaluateReleaseState(candidate)).toThrow(
      "RELEASE_CANDIDATE_NOT_READY",
    );
  expect(() => evaluateReleaseState(clean, "b".repeat(40))).toThrow(
    "RELEASE_CANDIDATE_NOT_READY",
  );
});
