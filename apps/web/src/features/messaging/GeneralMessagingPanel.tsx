import { useEffect, useRef, useState } from "react";
import type {
  GeneralConversationPageSchema,
  GeneralMessagePageSchema,
} from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
import {
  generalConversations,
  generalMessages,
  markGeneralRead,
  sendGeneralMessage,
} from "./general-api.js";
type Conversations = ReturnType<typeof GeneralConversationPageSchema.parse>;
type Messages = ReturnType<typeof GeneralMessagePageSchema.parse>;
export function GeneralMessagingPanel({
  clinic,
  canReply,
}: {
  clinic: boolean;
  canReply: boolean;
}) {
  const [conversations, setConversations] = useState<Conversations | null>(
    null,
  );
  const [selected, setSelected] = useState("");
  const [messages, setMessages] = useState<Messages | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState("");
  const key = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void generalConversations({}, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) {
          setConversations(page);
          if (clinic && page.items.length === 1) setSelected(page.items[0]!.id);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setNotice("Bisedat nuk u ngarkuan. Provoni sërish.");
      });
    return () => controller.abort();
  }, [clinic]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    void generalMessages({ conversation_id: selected }, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) setMessages(page);
      })
      .catch(() => {
        if (!controller.signal.aborted) setNotice("Mesazhet nuk u ngarkuan.");
      });
    return () => controller.abort();
  }, [selected]);
  async function reloadConversations() {
    setNotice("");
    try {
      const page = await generalConversations({});
      setConversations(page);
      if (clinic && page.items.length === 1) setSelected(page.items[0]!.id);
    } catch {
      setNotice("Bisedat nuk u ngarkuan. Provoni sërish.");
    }
  }
  async function moreConversations() {
    if (!conversations?.next_after) return;
    try {
      const page = await generalConversations({
        after: conversations.next_after,
      });
      setConversations({
        items: [...conversations.items, ...page.items],
        next_after: page.next_after,
      });
    } catch {
      setNotice("Klinikat e tjera nuk u ngarkuan.");
    }
  }
  async function refresh() {
    if (!selected) return;
    setNotice("");
    try {
      setMessages(await generalMessages({ conversation_id: selected }));
    } catch {
      setNotice("Mesazhet nuk u ngarkuan.");
    }
  }
  async function older() {
    if (!selected || !messages?.next_before_seq) return;
    try {
      const page = await generalMessages({
        conversation_id: selected,
        before_seq: messages.next_before_seq,
      });
      setMessages({
        ...page,
        messages: [...page.messages, ...messages.messages],
      });
    } catch {
      setNotice("Mesazhet e mëparshme nuk u ngarkuan.");
    }
  }
  const firstVisible = messages?.messages[0]?.sequence_number;
  const lastVisible = messages?.messages.at(-1)?.sequence_number;
  const canMarkRead =
    messages &&
    firstVisible !== undefined &&
    lastVisible !== undefined &&
    firstVisible <= messages.last_read_seq + 1 &&
    lastVisible > messages.last_read_seq;
  async function markVisibleRead() {
    if (!canMarkRead || !selected || reading || lastVisible === undefined)
      return;
    setReading(true);
    setNotice("");
    try {
      const receipt = await markGeneralRead({
        conversation_id: selected,
        through_seq: lastVisible,
      });
      setMessages((previous) =>
        previous?.conversation_id === receipt.conversation_id
          ? {
              ...previous,
              last_read_seq: Math.max(
                previous.last_read_seq,
                receipt.last_read_seq,
              ),
            }
          : previous,
      );
    } catch {
      setNotice("Leximi nuk u konfirmua. Rifreskoni bisedën.");
    } finally {
      setReading(false);
    }
  }
  async function send() {
    if (!selected || !body.trim() || busy) return;
    setBusy(true);
    setNotice("");
    key.current ??= crypto.randomUUID();
    try {
      const result = await sendGeneralMessage({
        conversation_id: selected,
        idempotency_key: key.current,
        body: body.trim(),
        file_ids: [],
      });
      if (result.kind !== "sent") {
        if (result.kind === "conflict") key.current = null;
        setNotice(
          result.kind === "conflict"
            ? "Mesazhi ndryshoi. Kontrolloni bisedën para një dërgimi të ri."
            : "Mesazhi nuk u dërgua. Kontrolloni bisedën.",
        );
        return;
      }
      key.current = null;
      setBody("");
      await refresh();
    } catch {
      setNotice(
        "Përgjigjja është e pasigurt. Kontrolloni bisedën ose riprovoni të njëjtin mesazh.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Biseda e përgjithshme">
      <h3>Biseda e përgjithshme</h3>
      <p>
        Komunikim me klinikën, i ndarë nga porositë. Kërkesat për të dhënat
        personale mund t'i shkruani këtu; përgjigjja në bisedë nuk është vendim
        për ndryshimin e porosisë.
      </p>
      {conversations && !conversations.items.length && (
        <p>Nuk u gjet bisedë e disponueshme.</p>
      )}
      <Button type="button" onClick={() => void reloadConversations()}>
        Rifresko bisedat
      </Button>
      {!clinic && (
        <label>
          Klinika
          <select
            value={selected}
            disabled={busy || reading}
            onChange={(e) => {
              setSelected(e.target.value);
              setMessages(null);
              setBody("");
              key.current = null;
            }}
          >
            <option value="">Zgjidhni klinikën</option>
            {conversations?.items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.clinic_name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!clinic && conversations?.next_after && (
        <Button type="button" onClick={() => void moreConversations()}>
          Më shumë klinika
        </Button>
      )}
      {selected && (
        <>
          <Button type="button" onClick={() => void refresh()}>
            Përditëso mesazhet
          </Button>
          {messages?.next_before_seq && (
            <Button type="button" onClick={() => void older()}>
              Mesazhe më të vjetra
            </Button>
          )}
          {canMarkRead && (
            <Button
              type="button"
              disabled={reading}
              onClick={() => void markVisibleRead()}
            >
              {reading
                ? "Duke konfirmuar..."
                : "Shëno mesazhet e hapura si të lexuara"}
            </Button>
          )}
          {messages &&
            firstVisible !== undefined &&
            firstVisible > messages.last_read_seq + 1 && (
              <p>Hapni mesazhet më të vjetra para konfirmimit të leximit.</p>
            )}
          <ol aria-label="Mesazhet">
            {messages?.messages.map((message) => (
              <li key={message.id}>
                <strong>
                  {message.sender_side === "clinic" ? "Klinika" : "Laboratori"}
                </strong>
                {" · "}
                <time dateTime={message.created_at}>{message.created_at}</time>
                {message.edited && " · Ndryshuar"}
                {message.sender_side === (clinic ? "clinic" : "laboratory") && (
                  <span>
                    {" · "}
                    {message.sequence_number <= messages.other_read_seq
                      ? "Lexuar"
                      : "Dërguar"}
                  </span>
                )}
                <p>{message.hidden ? "Mesazh i fshehur" : message.body}</p>
              </li>
            ))}
          </ol>
          {canReply && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <label>
                Mesazh tekstual
                <textarea
                  value={body}
                  disabled={busy}
                  maxLength={100000}
                  onChange={(event) => {
                    setBody(event.target.value);
                    key.current = null;
                  }}
                />
              </label>
              <Button type="submit" disabled={busy || !body.trim()}>
                Dërgo mesazhin
              </Button>
            </form>
          )}
          <p>Skedarët nuk janë të disponueshëm në këtë bisedë.</p>
        </>
      )}
      {notice && <p role="alert">{notice}</p>}
    </section>
  );
}
