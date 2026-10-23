import type { GeneralMessagePageSchema } from "@dental-lab/contracts";

type Page = ReturnType<typeof GeneralMessagePageSchema.parse>;
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
  if (!newest.messages[0] || newest.messages[0].sequence_number <= loaded + 1) {
    accept(newest);
    return true;
  }
  let cursor = loaded;
  for (let batch = 0; batch < maxBatches; batch++) {
    const page = await fetchPage({
      conversation_id: current.conversation_id,
      after_seq: cursor,
    });
    const next = page.messages.at(-1)?.sequence_number;
    if (next === undefined || next <= cursor)
      throw new Error("MESSAGE_CATCH_UP_STALLED");
    accept(page);
    cursor = next;
    if (!page.next_after_seq) return true;
  }
  return false;
}
