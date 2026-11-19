import type { MessageHistoryResultSchema } from "@dental-lab/contracts";

type Page = ReturnType<typeof MessageHistoryResultSchema.parse>;

export function appendMessageHistory(
  current: Page,
  incoming: Page,
  expectedCursor: number,
): Page {
  if (current.next_before_version !== expectedCursor) return current;
  const known = new Set(current.versions.map((entry) => entry.version_number));
  const older = incoming.versions.filter((entry) => {
    if (known.has(entry.version_number)) return false;
    known.add(entry.version_number);
    return true;
  });
  return {
    versions: [...current.versions, ...older],
    next_before_version:
      incoming.next_before_version === expectedCursor
        ? null
        : incoming.next_before_version,
  };
}
