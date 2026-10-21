import {
  GeneralConversationQuerySchema,
  GeneralConversationPageSchema,
  GeneralMessageQuerySchema,
  GeneralMessagePageSchema,
  MessageSubmissionSchema,
  MessageSubmissionResultSchema,
} from "@dental-lab/contracts";
async function post(url: string, body: unknown, signal?: AbortSignal) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error("MESSAGING_UNAVAILABLE");
  return response.json() as Promise<unknown>;
}
export async function generalConversations(raw: unknown, signal?: AbortSignal) {
  return GeneralConversationPageSchema.parse(
    await post(
      "/api/v1/messaging/general/conversations",
      GeneralConversationQuerySchema.parse(raw),
      signal,
    ),
  );
}
export async function generalMessages(raw: unknown, signal?: AbortSignal) {
  return GeneralMessagePageSchema.parse(
    await post(
      "/api/v1/messaging/general/messages",
      GeneralMessageQuerySchema.parse(raw),
      signal,
    ),
  );
}
export async function sendGeneralMessage(raw: unknown, signal?: AbortSignal) {
  const input = MessageSubmissionSchema.parse(raw);
  if (input.body === null || input.file_ids.length)
    throw new Error("FILES_UNAVAILABLE");
  return MessageSubmissionResultSchema.parse(
    await post("/api/v1/messaging/general/send", input, signal),
  );
}
