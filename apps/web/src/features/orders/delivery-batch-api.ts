import {
  DeliveryBatchCommandSchema,
  DeliveryBatchReceiptQuerySchema,
  DeliveryBatchResultSchema,
} from "@dental-lab/contracts";
export function createDeliveryBatchClient(transport: typeof fetch = fetch) {
  async function post(action: string, input: unknown, signal: AbortSignal) {
    const r = await transport("/api/v1/orders/delivery-batch-" + action, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
    if (r.status !== 200) throw new Error("DELIVERY_BATCH_UNVERIFIED");
    const data = await r.json();
    if (signal.aborted) throw new Error("ABORTED");
    return DeliveryBatchResultSchema.parse(data);
  }
  return {
    deliver: (raw: unknown, signal: AbortSignal) =>
      post("deliver", DeliveryBatchCommandSchema.parse(raw), signal),
    receipt: (receipt_id: string, signal: AbortSignal) =>
      post(
        "receipt",
        DeliveryBatchReceiptQuerySchema.parse({ receipt_id }),
        signal,
      ),
  };
}
