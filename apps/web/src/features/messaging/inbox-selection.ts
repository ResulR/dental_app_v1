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

// Pagination can overlap a refreshed result while conversations move in the
// inbox. Keep the newest visible row and avoid duplicate conversation keys.
export function mergeInboxPage(
  current: ReturnType<typeof MessagingInboxPageSchema.parse>,
  older: ReturnType<typeof MessagingInboxPageSchema.parse>,
): ReturnType<typeof MessagingInboxPageSchema.parse> {
  const seen = new Set(current.items.map((item) => item.conversation_id));
  const additional = older.items.filter((item) => {
    if (seen.has(item.conversation_id)) return false;
    seen.add(item.conversation_id);
    return true;
  });
  const repeatingCursor =
    older.next_before_at === current.next_before_at &&
    older.next_before_id === current.next_before_id;
  return {
    items: [...current.items, ...additional],
    next_before_at: repeatingCursor ? null : older.next_before_at,
    next_before_id: repeatingCursor ? null : older.next_before_id,
  };
}
