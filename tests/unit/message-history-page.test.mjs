import { test, expect } from "vitest";
import { appendMessageHistory } from "../../apps/web/src/features/messaging/message-history-page.ts";
const version = (version_number) => ({
  version_number,
  body: "Texte synthétique",
  created_at: "2026-10-21T10:00:00.000Z",
});
test("history keeps loaded versions and removes overlapping duplicate entries", () => {
  const current = {
    versions: [version(5), version(4)],
    next_before_version: 4,
  };
  const older = {
    versions: [version(4), version(3), version(3)],
    next_before_version: 3,
  };
  expect(appendMessageHistory(current, older, 4)).toEqual({
    versions: [version(5), version(4), version(3)],
    next_before_version: 3,
  });
  expect(appendMessageHistory(current, older, 2)).toBe(current);
});
test("unchanged history cursor cannot loop", () => {
  const current = { versions: [version(5)], next_before_version: 5 };
  expect(
    appendMessageHistory(
      current,
      { versions: [version(5)], next_before_version: 5 },
      5,
    ),
  ).toEqual({ ...current, next_before_version: null });
});
