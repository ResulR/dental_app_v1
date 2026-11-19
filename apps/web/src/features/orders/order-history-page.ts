import type { OrderTrackingDetailSchema } from "@dental-lab/contracts";

type Detail = ReturnType<typeof OrderTrackingDetailSchema.parse>;

export function appendOrderHistory(
  current: Detail,
  incoming: Detail,
  expectedCursor: number,
): Detail | null {
  if (current.next_before_revision !== expectedCursor) return current;
  if (
    incoming.order.id !== current.order.id ||
    incoming.order.revision !== current.order.revision ||
    incoming.history.some((event) => event.aggregate_revision >= expectedCursor)
  )
    return null;
  const seen = new Set(
    current.history.map((event) => event.aggregate_revision),
  );
  const older = incoming.history.filter((event) => {
    if (seen.has(event.aggregate_revision)) return false;
    seen.add(event.aggregate_revision);
    return true;
  });
  return {
    order: incoming.order,
    history: [...current.history, ...older],
    next_before_revision:
      incoming.next_before_revision === expectedCursor
        ? null
        : incoming.next_before_revision,
  };
}
