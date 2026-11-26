import { z } from "zod";

const orderId = z.uuid();
const prefix = "#/orders/";

export function privateOrderFragment(id: string) {
  return prefix + orderId.parse(id);
}

export function orderIdFromFragment(fragment: string) {
  if (!fragment.startsWith(prefix)) return null;
  const result = orderId.safeParse(fragment.slice(prefix.length));
  return result.success ? result.data : null;
}
