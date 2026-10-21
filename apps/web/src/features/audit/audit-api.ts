import { AuditLogQuerySchema, AuditLogPageSchema } from "@dental-lab/contracts";
export function createAuditClient(transport: typeof fetch = fetch) {
  return async (raw: unknown, signal: AbortSignal) => {
    const response = await transport("/api/v1/audit/page", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(AuditLogQuerySchema.parse(raw)),
      signal,
    });
    if (response.status !== 200) throw new Error("AUDIT_UNAVAILABLE");
    const data = await response.json();
    if (signal.aborted) throw new Error("ABORTED");
    return AuditLogPageSchema.parse(data);
  };
}
