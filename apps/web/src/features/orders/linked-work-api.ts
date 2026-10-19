import {
  LinkedWorkQuerySchema,
  LinkedWorkPageSchema,
} from "@dental-lab/contracts";
export function createLinkedWorkClient(transport: typeof fetch = fetch) {
  return {
    async list(raw: unknown, signal: AbortSignal) {
      const input = LinkedWorkQuerySchema.parse(raw);
      const response = await transport("/api/v1/orders/links", {
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
      const result = LinkedWorkPageSchema.parse(await response.json());
      if (signal.aborted) throw new Error("ORDER_SUBMISSION_UNCERTAIN");
      return result;
    },
  };
}
