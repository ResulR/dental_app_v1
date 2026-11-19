import type { LinkedWorkPage } from "@dental-lab/contracts";

export function appendLinkedWorkPage(
  current: LinkedWorkPage | null,
  expected: LinkedWorkPage,
  incoming: LinkedWorkPage,
  cursor: string,
): LinkedWorkPage | null {
  if (current !== expected || current.next_after !== cursor) return current;
  if (incoming.order.id !== current.order.id) return null;
  const known = new Set(current.items.map((link) => link.id));
  const additional = incoming.items.filter((link) => {
    if (known.has(link.id)) return false;
    known.add(link.id);
    return true;
  });
  return {
    ...incoming,
    items: [...current.items, ...additional],
    next_after: incoming.next_after === cursor ? null : incoming.next_after,
  };
}
