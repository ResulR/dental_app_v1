import type {
  GeneralMessagePageSchema,
  MessageSubmissionResult,
} from "@dental-lab/contracts";

type Page = ReturnType<typeof GeneralMessagePageSchema.parse>;
type Receipt = Extract<MessageSubmissionResult, { kind: "sent" }>;
export function confirmsMessageReceipt(
  page: Page,
  conversationId: string,
  originalBody: string,
  reply: Receipt,
) {
  return (
    page.conversation_id === conversationId &&
    page.messages.some(
      (row) =>
        row.id === reply.message_id &&
        row.sequence_number === reply.sequence_number &&
        row.created_at === reply.created_at &&
        row.own &&
        row.revision === 1 &&
        !row.hidden &&
        !row.edited &&
        row.body === originalBody,
    )
  );
}
