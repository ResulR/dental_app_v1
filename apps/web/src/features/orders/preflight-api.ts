import {
  OrderPreflightInputSchema,
  OrderPreflightResultSchema,
} from "@dental-lab/contracts";
export function createOrderPreflightClient(transport: typeof fetch = fetch) {
  return {
    async check(raw: unknown, signal: AbortSignal) {
      const input = OrderPreflightInputSchema.parse(raw);
      const response = await transport("/api/v1/orders/preflight", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal,
      });
      if (response.status !== 200) throw new Error("ORDER_CHECK_UNAVAILABLE");
      const result = OrderPreflightResultSchema.parse(await response.json());
      if (signal.aborted) throw new Error("ABORTED");
      return result;
    },
  };
}
