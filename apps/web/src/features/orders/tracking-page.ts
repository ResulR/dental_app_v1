import type { OrderTrackingPage } from "@dental-lab/contracts";

export function appendTrackingPage(
  previous: OrderTrackingPage,
  next: OrderTrackingPage,
  requestedCursor: string,
): OrderTrackingPage | null {
  if (previous.next_after !== requestedCursor) return previous;
  // A changed detail permission invalidates every row retained locally.
  if (previous.can_read_details !== next.can_read_details) return null;
  const seen = new Set(previous.items.map((row) => row.id));
  return {
    ...next,
    items: [
      ...previous.items,
      ...next.items.filter((row) => !seen.has(row.id)),
    ],
    next_after:
      next.next_after === requestedCursor ? null : next.next_after,
  };
}
