import {
  OrderSearchSchema,
  OrderDetailQuerySchema,
  OrderTrackingPageSchema,
  OrderTrackingDetailSchema,
} from "@dental-lab/contracts";
export function createOrderTrackingClient(transport: typeof fetch = fetch) {
  async function post(action: string, input: unknown, signal: AbortSignal) {
    const response = await transport("/api/v1/orders/" + action, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
    if (response.status !== 200) throw new Error("ORDER_TRACKING_UNAVAILABLE");
    const result = await response.json();
    if (signal.aborted) throw new Error("ABORTED");
    return result;
  }
  return {
    async search(raw: unknown, signal: AbortSignal) {
      return OrderTrackingPageSchema.parse(
        await post("search", OrderSearchSchema.parse(raw), signal),
      );
    },
    async detail(raw: unknown, signal: AbortSignal) {
      return OrderTrackingDetailSchema.parse(
        await post("detail", OrderDetailQuerySchema.parse(raw), signal),
      );
    },
  };
}
