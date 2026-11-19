import type { OrderModificationHistory } from "@dental-lab/contracts";

export function appendModificationHistory(
  current: OrderModificationHistory | null,
  incoming: OrderModificationHistory,
  expectedCursor?: string,
): OrderModificationHistory | null {
  if (!expectedCursor) return incoming;
  if (!current || current.next_before_request_id !== expectedCursor)
    return current;
  const known = new Set(current.items.map((item) => item.id));
  const additional = incoming.items.filter((item) => {
    if (known.has(item.id)) return false;
    known.add(item.id);
    return true;
  });
  return {
    items: [...current.items, ...additional],
    next_before_request_id:
      incoming.next_before_request_id === expectedCursor
        ? null
        : incoming.next_before_request_id,
  };
}
