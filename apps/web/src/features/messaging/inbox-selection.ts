import type {
  GeneralConversationPageSchema,
  OrderConversationResultSchema,
  MessagingInboxPageSchema,
} from "@dental-lab/contracts";

type InboxItem = ReturnType<
  typeof MessagingInboxPageSchema.parse
>["items"][number];
type GeneralPage = ReturnType<typeof GeneralConversationPageSchema.parse>;

export function refreshSelectedGeneral(
  selected: InboxItem,
  current: GeneralPage,
): InboxItem | null {
  const found = current.items.find(
    (item) => item.id === selected.conversation_id,
  );
  return found && found.clinic_id === selected.clinic_id
    ? {
        ...selected,
        clinic_name: found.clinic_name,
        unread_count: found.unread_count,
      }
    : null;
}

export function refreshSelectedOrder(
  selected: InboxItem,
  current: ReturnType<typeof OrderConversationResultSchema.parse>,
): InboxItem | null {
  return selected.kind === "order" &&
    selected.order_id === current.order_id &&
    selected.conversation_id === current.id &&
    selected.clinic_id === current.clinic_id
    ? {
        ...selected,
        closed: current.closed,
        unread_count: current.unread_count,
      }
    : null;
}
