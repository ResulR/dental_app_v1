import {
  OrderReviewPageSchema,
  OrderDecisionSchema,
  OrderDecisionResultSchema,
} from "@dental-lab/contracts";
export function createOrderDecisionClient(transport: typeof fetch = fetch) {
  return {
    async list(signal: AbortSignal, after?: string) {
      const response = await transport(
        "/api/v1/orders/review" +
          (after ? "?after=" + encodeURIComponent(after) : ""),
        {
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          signal,
        },
      );
      if (response.status !== 200) throw new Error("ORDER_REVIEW_UNAVAILABLE");
      const page = OrderReviewPageSchema.parse(await response.json());
      if (signal.aborted) throw new Error("ABORTED");
      return page;
    },
    async decide(raw: unknown, signal: AbortSignal) {
      const input = OrderDecisionSchema.parse(raw),
        response = await transport("/api/v1/orders/decision", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
          signal,
        });
      if (response.status !== 200) throw new Error("ORDER_DECISION_UNCERTAIN");
      const result = OrderDecisionResultSchema.parse(await response.json());
      if (signal.aborted) throw new Error("ABORTED");
      return result;
    },
  };
}
