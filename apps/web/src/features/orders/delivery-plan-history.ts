import type { DeliveryPlanHistoryPage } from "@dental-lab/contracts";

export function appendDeliveryPlanHistory(
  current: DeliveryPlanHistoryPage,
  incoming: DeliveryPlanHistoryPage,
  cursor: string,
): DeliveryPlanHistoryPage | null {
  if (
    current.order_id !== incoming.order_id ||
    current.logistics_revision !== incoming.logistics_revision ||
    current.next_before_event_id !== cursor ||
    incoming.items.some((item) => item.id === cursor) ||
    (incoming.next_before_event_id !== null && incoming.items.length === 0)
  )
    return null;
  const seen = new Set(current.items.map((item) => item.id));
  const additions = incoming.items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return {
    ...current,
    items: [...current.items, ...additions],
    next_before_event_id: incoming.next_before_event_id,
  };
}
