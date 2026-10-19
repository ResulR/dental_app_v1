import {
  OrderModificationProposalSchema,
  OrderModificationDecisionSchema,
  OrderModificationContextSchema,
  OrderLifecycleContextQuerySchema,
  OrderEditResultSchema,
} from "@dental-lab/contracts";
export function createOrderModificationClient(transport: typeof fetch = fetch) {
  async function post(action: string, body: unknown, signal: AbortSignal) {
    const r = await transport("/api/v1/orders/modification-" + action, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (r.status !== 200) throw new Error("MODIFICATION_UNVERIFIED");
    const value = await r.json();
    if (signal.aborted) throw new Error("ABORTED");
    return value;
  }
  return {
    async propose(raw: unknown, signal: AbortSignal) {
      return OrderEditResultSchema.parse(
        await post(
          "propose",
          OrderModificationProposalSchema.parse(raw),
          signal,
        ),
      );
    },
    async decide(raw: unknown, signal: AbortSignal) {
      return OrderEditResultSchema.parse(
        await post(
          "decide",
          OrderModificationDecisionSchema.parse(raw),
          signal,
        ),
      );
    },
    async context(order_id: string, signal: AbortSignal) {
      return OrderModificationContextSchema.parse(
        await post(
          "context",
          OrderLifecycleContextQuerySchema.parse({ order_id }),
          signal,
        ),
      );
    },
  };
}
