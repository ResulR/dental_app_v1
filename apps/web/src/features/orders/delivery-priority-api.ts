import {
  DeliveryPriorityQuerySchema,
  DeliveryPriorityCommandSchema,
  DeliveryPriorityContextSchema,
  DeliveryPriorityResultSchema,
} from "@dental-lab/contracts";
export function createDeliveryPriorityClient(transport: typeof fetch = fetch) {
  async function post(action: string, body: unknown, signal: AbortSignal) {
    const response = await transport(
      "/api/v1/orders/delivery-priority-" + action,
      {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal,
      },
    );
    if (response.status !== 200)
      throw new Error("DELIVERY_PRIORITY_UNVERIFIED");
    const data = await response.json();
    if (signal.aborted) throw new Error("ABORTED");
    return data;
  }
  return {
    context(id: string, signal: AbortSignal) {
      return post(
        "context",
        DeliveryPriorityQuerySchema.parse({ order_id: id }),
        signal,
      ).then((data) => DeliveryPriorityContextSchema.parse(data));
    },
    update(raw: unknown, signal: AbortSignal) {
      return post(
        "update",
        DeliveryPriorityCommandSchema.parse(raw),
        signal,
      ).then((data) => DeliveryPriorityResultSchema.parse(data));
    },
  };
}
