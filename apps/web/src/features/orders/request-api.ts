import {
  OrderCancellationRequestSchema,
  OrderRequestResultSchema,
  OrderLifecycleContextQuerySchema,
  OrderRequestContextSchema,
} from "@dental-lab/contracts";
export function createOrderRequestClient(transport: typeof fetch = fetch) {
  async function post(path: string, body: unknown, signal: AbortSignal) {
    const r = await transport("/api/v1/orders/" + path, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (r.status !== 200) throw new Error("ORDER_ACTION_UNVERIFIED");
    const data = await r.json();
    if (signal.aborted) throw new Error("ABORTED");
    return data;
  }
  return {
    async context(order_id: string, signal: AbortSignal) {
      return OrderRequestContextSchema.parse(
        await post(
          "request-context",
          OrderLifecycleContextQuerySchema.parse({ order_id }),
          signal,
        ),
      );
    },
    async decide(raw: unknown, signal: AbortSignal) {
      return OrderRequestResultSchema.parse(
        await post(
          "cancellation-request",
          OrderCancellationRequestSchema.parse(raw),
          signal,
        ),
      );
    },
  };
}
