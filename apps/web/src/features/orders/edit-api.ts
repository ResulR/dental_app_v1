import {
  OrderEditSchema,
  OrderEditResultSchema,
  OrderEditQuerySchema,
  OrderEditViewSchema,
} from "@dental-lab/contracts";
export function createOrderEditClient(transport: typeof fetch = fetch) {
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
    if (r.status !== 200) throw new Error("ORDER_EDIT_UNVERIFIED");
    const value = await r.json();
    if (signal.aborted) throw new Error("ABORTED");
    return value;
  }
  return {
    async context(raw: unknown, signal: AbortSignal) {
      const query = OrderEditQuerySchema.parse(raw);
      const view = OrderEditViewSchema.parse(await post("edit-context", query, signal));
      if (view.order_id !== query.order_id ||
          view.version_id !== (query.version_id ?? view.current_version_id)) {
        throw new Error("ORDER_EDIT_SCOPE_CHANGED");
      }
      return view;
    },
    async decide(raw: unknown, signal: AbortSignal) {
      return OrderEditResultSchema.parse(
        await post("edit", OrderEditSchema.parse(raw), signal),
      );
    },
  };
}
