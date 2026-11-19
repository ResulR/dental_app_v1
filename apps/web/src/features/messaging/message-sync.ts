import type {
  GeneralConversationPageSchema,
  GeneralMessagePageSchema,
} from "@dental-lab/contracts";

type Conversations = ReturnType<typeof GeneralConversationPageSchema.parse>;
export function hasAuthorizedConversation(
  page: Conversations,
  id: string,
  clinicId?: string,
) {
  return page.items.some(
    (item) => item.id === id && (!clinicId || item.clinic_id === clinicId),
  );
}
export function appendConversationPage(
  current: Conversations | null,
  expected: Conversations,
  incoming: Conversations,
  cursor: string,
): Conversations | null {
  if (current !== expected || current.next_after !== cursor) return current;
  const known = new Set(current.items.map((item) => item.id));
  const additional = incoming.items.filter((item) => {
    if (known.has(item.id)) return false;
    known.add(item.id);
    return true;
  });
  return {
    items: [...current.items, ...additional],
    next_after: incoming.next_after === cursor ? null : incoming.next_after,
  };
}

type Page = ReturnType<typeof GeneralMessagePageSchema.parse>;
export function confirmsMutatedMessage(
  page: Page,
  conversationId: string,
  messageId: string,
  revision: number,
) {
  return (
    page.conversation_id === conversationId &&
    page.messages.some(
      (message) => message.id === messageId && message.revision >= revision,
    )
  );
}
export function mergeMessagePage(
  current: Page,
  incoming: Page,
  older = false,
): Page {
  if (current.conversation_id !== incoming.conversation_id) return incoming;
  const bySequence = new Map(
    current.messages.map((message) => [message.sequence_number, message]),
  );
  for (const message of incoming.messages)
    bySequence.set(message.sequence_number, message);
  const all = [...bySequence.values()].sort(
    (left, right) => left.sequence_number - right.sequence_number,
  );
  const messages = older ? all : all.slice(-250);
  return {
    ...incoming,
    messages,
    last_message_seq: Math.max(
      current.last_message_seq,
      incoming.last_message_seq,
    ),
    last_read_seq: Math.max(current.last_read_seq, incoming.last_read_seq),
    other_read_seq: Math.max(current.other_read_seq, incoming.other_read_seq),
    next_before_seq:
      all.length > messages.length
        ? messages[0]!.sequence_number
        : older
          ? incoming.next_before_seq
          : (current.next_before_seq ?? incoming.next_before_seq),
    next_after_seq: incoming.next_after_seq,
  };
}
export function contiguousReadThrough(
  lastReadSeq: number,
  actuallyVisible: ReadonlySet<number>,
) {
  let through = lastReadSeq;
  while (actuallyVisible.has(through + 1)) through++;
  return through;
}

function assertSequence(page: Page, conversationId: string, first?: number) {
  if (page.conversation_id !== conversationId)
    throw new Error("MESSAGE_CATCH_UP_SCOPE");
  let previous = first === undefined ? undefined : first - 1;
  for (const message of page.messages) {
    if (previous !== undefined && message.sequence_number !== previous + 1)
      throw new Error("MESSAGE_CATCH_UP_GAP");
    previous = message.sequence_number;
  }
  if (previous !== undefined && previous > page.last_message_seq)
    throw new Error("MESSAGE_CATCH_UP_SEQUENCE");
}

export async function catchUpMessages(
  current: Page,
  fetchPage: (query: {
    conversation_id: string;
    after_seq?: number;
  }) => Promise<Page>,
  accept: (page: Page) => void,
  maxBatches = 5,
) {
  const newest = await fetchPage({ conversation_id: current.conversation_id });
  const loaded = current.messages.at(-1)?.sequence_number ?? 0;
  assertSequence(newest, current.conversation_id);
  if (
    newest.last_message_seq < loaded ||
    (!newest.messages.length && newest.last_message_seq > loaded)
  )
    throw new Error("MESSAGE_CATCH_UP_STALLED");
  if (!newest.messages[0] || newest.messages[0].sequence_number <= loaded + 1) {
    if (
      newest.messages.at(-1)?.sequence_number !== newest.last_message_seq &&
      newest.last_message_seq > loaded
    )
      throw new Error("MESSAGE_CATCH_UP_GAP");
    accept(newest);
    return true;
  }
  let cursor = loaded;
  for (let batch = 0; batch < maxBatches; batch++) {
    const page = await fetchPage({
      conversation_id: current.conversation_id,
      after_seq: cursor,
    });
    assertSequence(page, current.conversation_id, cursor + 1);
    const next = page.messages.at(-1)?.sequence_number;
    if (
      next === undefined ||
      next <= cursor ||
      (page.next_after_seq !== null && page.next_after_seq !== next) ||
      (page.next_after_seq === null && next !== page.last_message_seq)
    )
      throw new Error("MESSAGE_CATCH_UP_STALLED");
    accept(page);
    cursor = next;
    if (!page.next_after_seq) return true;
  }
  return false;
}

// UI-only in-flight token. A late completion must not release a newer read;
// server-side receipts remain the durable, monotone authority.
export function createReadFlight() {
  let pending: symbol | null = null;
  return {
    get busy() {
      return pending !== null;
    },
    begin() {
      if (pending !== null) return null;
      pending = Symbol("read");
      return pending;
    },
    finish(token: symbol) {
      if (pending !== token) return false;
      pending = null;
      return true;
    },
  };
}
