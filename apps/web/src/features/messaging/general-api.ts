import {
  GeneralConversationQuerySchema,
  OrderConversationQuerySchema,
  OrderConversationResultSchema,
  GeneralConversationPageSchema,
  GeneralMessageQuerySchema,
  GeneralMessagePageSchema,
  GeneralReadCommandSchema,
  GeneralReadReceiptSchema,
  MessageSubmissionSchema,
  MessageSubmissionResultSchema,
  MessageMutationSchema,
  MessageMutationResultSchema,
  MessageHistoryQuerySchema,
  MessageHistoryResultSchema,
  MessagingInboxQuerySchema,
  MessagingInboxPageSchema,
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

export async function mutateTextMessage(
  kind: "general" | "order",
  action: "edit" | "hide",
  raw: unknown,
) {
  const input = MessageMutationSchema.parse(raw);
  return MessageMutationResultSchema.parse(
    await post("/api/v1/messaging/" + kind + "/" + action, input),
  );
}
export async function textMessageHistory(
  kind: "general" | "order",
  raw: unknown,
) {
  return MessageHistoryResultSchema.parse(
    await post(
      "/api/v1/messaging/" + kind + "/history",
      MessageHistoryQuerySchema.parse(raw),
    ),
  );
}
export async function messagingInbox(raw: unknown, signal?: AbortSignal) {
  return MessagingInboxPageSchema.parse(
    await post(
      "/api/v1/messaging/inbox/list",
      MessagingInboxQuerySchema.parse(raw),
      signal,
    ),
  );
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
export async function orderConversation(raw: unknown, signal?: AbortSignal) {
  return OrderConversationResultSchema.parse(
    await post(
      "/api/v1/messaging/order/conversation",
      OrderConversationQuerySchema.parse(raw),
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
export async function orderMessages(raw: unknown, signal?: AbortSignal) {
  return GeneralMessagePageSchema.parse(
    await post(
      "/api/v1/messaging/order/messages",
      GeneralMessageQuerySchema.parse(raw),
      signal,
    ),
  );
}
export async function markGeneralRead(raw: unknown, signal?: AbortSignal) {
  return GeneralReadReceiptSchema.parse(
    await post(
      "/api/v1/messaging/general/markRead",
      GeneralReadCommandSchema.parse(raw),
      signal,
    ),
  );
}
export async function markOrderRead(raw: unknown, signal?: AbortSignal) {
  return GeneralReadReceiptSchema.parse(
    await post(
      "/api/v1/messaging/order/markRead",
      GeneralReadCommandSchema.parse(raw),
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

export async function sendOrderMessage(raw: unknown, signal?: AbortSignal) {
  const input = MessageSubmissionSchema.parse(raw);
  if (input.body === null || input.file_ids.length)
    throw new Error("FILES_UNAVAILABLE");
  return MessageSubmissionResultSchema.parse(
    await post("/api/v1/messaging/order/send", input, signal),
  );
}
