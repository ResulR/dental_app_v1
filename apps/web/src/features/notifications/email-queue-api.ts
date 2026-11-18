import {
  EmailQueuePageSchema,
  EmailQueueQuerySchema,
} from "@dental-lab/contracts";
export function createEmailQueueClient(transport: typeof fetch = fetch) {
  return async (raw: unknown, signal: AbortSignal) => {
    const response = await transport("/api/v1/notifications/email-queue/page", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(EmailQueueQuerySchema.parse(raw)),
      signal,
    });
    if (response.status !== 200) throw new Error("EMAIL_QUEUE_UNAVAILABLE");
    const data = await response.json();
    if (signal.aborted) throw new Error("ABORTED");
    return EmailQueuePageSchema.parse(data);
  };
}
