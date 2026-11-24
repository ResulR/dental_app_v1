import type { ActionInboxPage } from "@dental-lab/contracts";

// Each page is authorized independently. Never retain earlier rows after a
// permission change, and never advance a cursor that did not move.
export function appendActionInboxPage(
  previous: ActionInboxPage,
  next: ActionInboxPage,
): ActionInboxPage {
  if (JSON.stringify(previous.permissions) !== JSON.stringify(next.permissions))
    return next;
  const seen = new Set(previous.items.map((item) => `${item.kind}:${item.id}`));
  return {
    ...next,
    items: [
      ...previous.items,
      ...next.items.filter((item) => !seen.has(`${item.kind}:${item.id}`)),
    ],
    next_after:
      JSON.stringify(previous.next_after) === JSON.stringify(next.next_after)
        ? null
        : next.next_after,
  };
}
