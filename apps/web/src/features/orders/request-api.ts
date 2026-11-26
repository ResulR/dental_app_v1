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
      const context = OrderRequestContextSchema.parse(
        await post(
          "request-context",
          OrderLifecycleContextQuerySchema.parse({ order_id }),
          signal,
        ),
      );
      if (context.order.order_id !== order_id)
        throw new Error("ORDER_REQUEST_SCOPE_CHANGED");
      return context;
    },
    async decide(raw: unknown, signal: AbortSignal) {
      const command = OrderCancellationRequestSchema.parse(raw);
      const reply = OrderRequestResultSchema.parse(
        await post("cancellation-request", command, signal),
      );
      const expected = {
        request_cancellation: "pending",
        withdraw: "withdrawn",
        accept_cancellation: "accepted",
        reject_cancellation: "rejected",
      } as const;
      if (
        reply.kind === "updated" &&
        (reply.order_id !== command.order_id ||
          reply.state !== expected[command.action] ||
          ("request_id" in command && reply.request_id !== command.request_id))
      )
        throw new Error("ORDER_REQUEST_REPLY_CONTRADICTORY");
      return reply;
    },
  };
}
