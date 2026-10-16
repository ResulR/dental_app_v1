import {
  OrderSubmissionSchema,
  OrderSubmissionResultSchema,
} from "@dental-lab/contracts";
export function createOrderSubmissionClient(transport: typeof fetch = fetch) {
  return {
    async submit(raw: unknown, signal: AbortSignal) {
      const input = OrderSubmissionSchema.parse(raw);
      const response = await transport("/api/v1/orders", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal,
      });
      if (response.status !== 200)
        throw new Error("ORDER_SUBMISSION_UNCERTAIN");
      const result = OrderSubmissionResultSchema.parse(await response.json());
      if (signal.aborted) throw new Error("ORDER_SUBMISSION_UNCERTAIN");
      return result;
    },
  };
}
