import {
  OrderSimilarityInputSchema,
  OrderSimilarityResultSchema,
} from "@dental-lab/contracts";

export function createOrderSimilarityClient(transport: typeof fetch = fetch) {
  return {
    async check(raw: unknown, signal: AbortSignal) {
      const input = OrderSimilarityInputSchema.parse(raw);
      const response = await transport("/api/v1/orders/similar", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal,
      });
      if (response.status !== 200)
        throw new Error("ORDER_SIMILARITY_UNAVAILABLE");
      const result = OrderSimilarityResultSchema.parse(await response.json());
      if (signal.aborted) throw new Error("ABORTED");
      return result;
    },
  };
}
