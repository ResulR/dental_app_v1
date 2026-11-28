import {
  DeliveryPlanQuerySchema,
  DeliveryPlanCommandSchema,
  DeliveryPlanContextSchema,
  DeliveryPlanResultSchema,
  DeliveryPlanHistoryQuerySchema,
  DeliveryPlanHistoryPageSchema,
} from "@dental-lab/contracts";
export function createDeliveryPlanClient(transport: typeof fetch = fetch) {
  async function post(path: string, body: unknown, signal: AbortSignal) {
    const response = await transport("/api/v1/orders/delivery-plan-" + path, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (response.status !== 200) throw new Error("DELIVERY_PLAN_UNVERIFIED");
    const value = await response.json();
    if (signal.aborted) throw new Error("ABORTED");
    return value;
  }
  return {
    async context(orderId: string, signal: AbortSignal) {
      const value = DeliveryPlanContextSchema.parse(
        await post(
          "context",
          DeliveryPlanQuerySchema.parse({ order_id: orderId }),
          signal,
        ),
      );
      if (value.order_id !== orderId)
        throw new Error("DELIVERY_PLAN_SCOPE_CHANGED");
      return value;
    },
    history(raw: unknown, signal: AbortSignal) {
      return post(
        "history",
        DeliveryPlanHistoryQuerySchema.parse(raw),
        signal,
      ).then((value) => DeliveryPlanHistoryPageSchema.parse(value));
    },
    update(raw: unknown, signal: AbortSignal) {
      return post("update", DeliveryPlanCommandSchema.parse(raw), signal).then(
        (value) => DeliveryPlanResultSchema.parse(value),
      );
    },
  };
}
