import {
  ActionInboxQuerySchema,
  ActionInboxPageSchema,
} from "@dental-lab/contracts";
export function createActionInboxClient(transport: typeof fetch = fetch) {
  return {
    async list(raw: unknown, signal: AbortSignal) {
      const input = ActionInboxQuerySchema.parse(raw);
      const r = await transport("/api/v1/orders/actions", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal,
      });
      if (r.status !== 200) throw new Error("ACTION_INBOX_UNAVAILABLE");
      const page = ActionInboxPageSchema.parse(await r.json());
      if (signal.aborted) throw new Error("ACTION_INBOX_UNAVAILABLE");
      return page;
    },
  };
}
