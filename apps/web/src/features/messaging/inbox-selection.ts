import type {
  GeneralConversationPageSchema,
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
    ? { ...selected, unread_count: found.unread_count }
    : null;
}
