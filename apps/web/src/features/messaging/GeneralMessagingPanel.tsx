import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GeneralConversationPageSchema,
  GeneralMessagePageSchema,
  MessageHistoryResultSchema,
} from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
import {
  catchUpMessages,
  contiguousReadThrough,
  mergeMessagePage,
} from "./message-sync.js";
import {
  generalConversations,
  generalMessages,
  markGeneralRead,
  sendGeneralMessage,
  orderConversation,
  orderMessages,
  markOrderRead,
  sendOrderMessage,
  mutateTextMessage,
  textMessageHistory,
} from "./general-api.js";
type Conversations = ReturnType<typeof GeneralConversationPageSchema.parse>;
type Messages = ReturnType<typeof GeneralMessagePageSchema.parse>;
type History = ReturnType<typeof MessageHistoryResultSchema.parse>;
export function GeneralMessagingPanel({
  clinic,
  canReply,
  orderId,
  generalClinicId,
}: {
  clinic: boolean;
  canReply: boolean;
  orderId?: string;
  generalClinicId?: string;
}) {
  const [conversations, setConversations] = useState<Conversations | null>(
    null,
  );
  const [selected, setSelected] = useState("");
  const [closed, setClosed] = useState(false);
  const [editing, setEditing] = useState<{
    id: string;
    revision: number;
    body: string;
  } | null>(null);
  const [history, setHistory] = useState<{ id: string; page: History } | null>(
    null,
  );
  const [mutating, setMutating] = useState(false);
  const fetchMessages = orderId ? orderMessages : generalMessages;
  const acknowledge = orderId ? markOrderRead : markGeneralRead;
  const submit = orderId ? sendOrderMessage : sendGeneralMessage;
  const fetchConversations = useCallback(
    async (
      raw: unknown,
      signal?: AbortSignal,
    ): Promise<Conversations & { closed?: boolean }> => {
      if (!orderId)
        return generalConversations(
          generalClinicId
            ? { ...(raw as object), clinic_id: generalClinicId }
            : raw,
          signal,
        );
      const item = await orderConversation({ order_id: orderId }, signal);
      return {
        closed: item.closed,
        items: [
          {
            id: item.id,
            clinic_id: item.clinic_id,
            clinic_name: "",
            last_message_seq: item.last_message_seq,
            unread_count: item.unread_count,
          },
        ],
        next_after: null,
      };
    },
    [orderId, generalClinicId],
  );
  const [messages, setMessages] = useState<Messages | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState("");
  const [connection, setConnection] = useState<
    "connected" | "waiting" | "offline"
  >("waiting");
  const latestPage = useRef<Messages | null>(null);
  const latestConversations = useRef<Conversations | null>(null);
  const key = useRef<string | null>(null);
  const messageList = useRef<HTMLOListElement>(null);
  const seen = useRef<{
    conversationId: string;
    sequences: Set<number>;
  } | null>(null);
  const readPending = useRef(false);
  useEffect(() => {
    latestPage.current = messages;
  }, [messages]);
  useEffect(() => {
    latestConversations.current = conversations;
  }, [conversations]);
  const loadConversationCounts = useCallback(
    async (conversationId: string, signal?: AbortSignal) => {
      const first = await fetchConversations({}, signal);
      const known = latestConversations.current?.items.find(
        (item) => item.id === conversationId,
      );
      if (!known || first.items.some((item) => item.id === conversationId))
        return first;
      const scoped = await fetchConversations(
        { clinic_id: known.clinic_id },
        signal,
      );
      return { ...first, items: [...first.items, ...scoped.items] };
    },
    [fetchConversations],
  );
  useEffect(() => {
    const controller = new AbortController();
    void fetchConversations({}, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) {
          setConversations(page);
          if (page.closed !== undefined) setClosed(page.closed);
          if (
            (clinic || orderId || generalClinicId) &&
            page.items.length === 1
          ) {
            setLoadingMessages(true);
            setMessages(null);
            setSelected(page.items[0]!.id);
          }
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setNotice("Bisedat nuk u ngarkuan. Provoni sërish.");
      });
    return () => controller.abort();
  }, [clinic, orderId, generalClinicId, fetchConversations]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    void fetchMessages({ conversation_id: selected }, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) {
          setMessages(page);
          setConnection("connected");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setMessages(null);
          setNotice("Mesazhet nuk u ngarkuan ose lejet ndryshuan.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingMessages(false);
      });
    return () => controller.abort();
  }, [selected, fetchMessages]);
  async function reloadConversations() {
    setNotice("");
    try {
      const page = await fetchConversations({});
      setConversations(page);
      if (page.closed !== undefined) setClosed(page.closed);
      if ((clinic || orderId || generalClinicId) && page.items.length === 1)
        setSelected(page.items[0]!.id);
    } catch {
      setNotice("Bisedat nuk u ngarkuan. Provoni sërish.");
    }
  }
  async function moreConversations() {
    if (!conversations?.next_after) return;
    try {
      const page = await fetchConversations({
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
    setLoadingMessages(true);
    try {
      const current = latestPage.current;
      if (current?.conversation_id === selected) {
        await catchUpMessages(
          current,
          (query) => fetchMessages(query),
          (page) =>
            setMessages((previous) =>
              previous?.conversation_id === selected
                ? mergeMessagePage(previous, page)
                : previous,
            ),
        );
      } else {
        setMessages(await fetchMessages({ conversation_id: selected }));
      }
      setConnection("connected");
    } catch {
      setMessages(null);
      setNotice("Mesazhet nuk u ngarkuan ose lejet ndryshuan.");
    } finally {
      setLoadingMessages(false);
    }
  }
  async function older() {
    if (!selected || !messages?.next_before_seq || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await fetchMessages({
        conversation_id: selected,
        before_seq: messages.next_before_seq,
      });
      setMessages((previous) =>
        previous?.conversation_id === page.conversation_id
          ? mergeMessagePage(previous, page, true)
          : previous,
      );
    } catch {
      setNotice("Mesazhet e mëparshme nuk u ngarkuan.");
    } finally {
      setLoadingOlder(false);
    }
  }
  const firstVisible = messages?.messages[0]?.sequence_number;
  useEffect(() => {
    if (!selected || !messages || typeof IntersectionObserver === "undefined")
      return;
    if (seen.current?.conversationId !== selected)
      seen.current = { conversationId: selected, sequences: new Set() };
    let active = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (document.hidden || readPending.current || !active) return;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 1) {
            const sequence = Number(
              (entry.target as HTMLElement).dataset.sequence,
            );
            if (Number.isSafeInteger(sequence))
              seen.current?.sequences.add(sequence);
          }
        }
        const through = contiguousReadThrough(
          messages.last_read_seq,
          seen.current!.sequences,
        );
        if (through <= messages.last_read_seq) return;
        readPending.current = true;
        setReading(true);
        void acknowledge({
          conversation_id: selected,
          through_seq: through,
        })
          .then((receipt) => {
            if (!active) return;
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
            void loadConversationCounts(selected)
              .then((page) => {
                if (active)
                  setConversations((previous) =>
                    previous
                      ? {
                          ...previous,
                          items: previous.items.map(
                            (item) =>
                              page.items.find(
                                (fresh) => fresh.id === item.id,
                              ) ?? item,
                          ),
                        }
                      : page,
                  );
              })
              .catch(() => {
                if (active) setConnection("offline");
              });
          })
          .catch(() => {
            if (active)
              setNotice("Leximi nuk u konfirmua. Provoni të rilidheni.");
          })
          .finally(() => {
            readPending.current = false;
            setReading(false);
          });
      },
      { threshold: 1 },
    );
    for (const element of messageList.current?.querySelectorAll(
      "span[data-read-end]",
    ) ?? [])
      observer.observe(element);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [selected, messages, acknowledge, loadConversationCounts]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    let inFlight = false;
    const controller = new AbortController();
    async function sync() {
      if (!active || inFlight || document.hidden) return;
      if (!navigator.onLine) {
        setConnection("offline");
        return;
      }
      const current = latestPage.current;
      if (!current || current.conversation_id !== selected) return;
      inFlight = true;
      try {
        const list = await loadConversationCounts(selected, controller.signal);
        await catchUpMessages(
          current,
          (query) => fetchMessages(query, controller.signal),
          (page) => {
            if (active)
              setMessages((previous) =>
                previous?.conversation_id === selected
                  ? mergeMessagePage(previous, page)
                  : previous,
              );
          },
        );
        if (!active) return;
        if (list.closed !== undefined) setClosed(list.closed);
        setConversations((previous) =>
          previous
            ? {
                ...previous,
                items: previous.items.map(
                  (item) =>
                    list.items.find((fresh) => fresh.id === item.id) ?? item,
                ),
              }
            : list,
        );
        setConnection("connected");
      } catch {
        if (active) {
          setConnection("offline");
          setMessages(null);
          setConversations(null);
        }
      } finally {
        inFlight = false;
      }
    }
    const timer = window.setInterval(() => void sync(), 10_000);
    const resume = () => {
      if (!document.hidden) void sync();
    };
    const disconnected = () => setConnection("offline");
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    window.addEventListener("offline", disconnected);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", disconnected);
    };
  }, [selected, fetchMessages, loadConversationCounts]);
  async function changeMessage(
    message: Messages["messages"][number],
    action: "edit" | "hide",
  ) {
    if (
      !message.own ||
      !canReply ||
      message.hidden ||
      closed ||
      mutating ||
      !selected
    )
      return;
    if (
      action === "hide" &&
      !window.confirm("Ta fshihni këtë mesazh? Teksti nuk do të shfaqet më.")
    )
      return;
    setMutating(true);
    setNotice("");
    try {
      const result = await mutateTextMessage(
        orderId ? "order" : "general",
        action,
        {
          conversation_id: selected,
          message_id: message.id,
          expected_revision: message.revision,
          ...(action === "edit" ? { body: editing?.body ?? "" } : {}),
        },
      );
      if (result.kind !== "updated") {
        if (result.kind === "closed") setClosed(true);
        setNotice(
          result.kind === "closed"
            ? "Biseda është mbyllur; ndryshimi nuk u ruajt."
            : "Mesazhi ndryshoi në një sesion tjetër. Ringarkoni dhe provoni sërish.",
        );
        return;
      }
      setEditing(null);
      const page = await fetchMessages({
        conversation_id: selected,
        before_seq: message.sequence_number + 1,
      });
      setMessages((previous) =>
        previous?.conversation_id === selected
          ? mergeMessagePage(previous, page, true)
          : previous,
      );
    } catch {
      setNotice(
        "Nuk dihet nëse ndryshimi u ruajt. Ringarkoni bisedën para se të provoni sërish.",
      );
    } finally {
      setMutating(false);
    }
  }
  async function openHistory(messageId: string, beforeVersion?: number) {
    if (!selected) return;
    try {
      const page = await textMessageHistory(orderId ? "order" : "general", {
        conversation_id: selected,
        message_id: messageId,
        ...(beforeVersion ? { before_version: beforeVersion } : {}),
      });
      setHistory((previous) =>
        previous?.id === messageId && beforeVersion
          ? {
              id: messageId,
              page: {
                versions: [...previous.page.versions, ...page.versions],
                next_before_version: page.next_before_version,
              },
            }
          : { id: messageId, page },
      );
    } catch {
      setNotice("Historiku nuk u ngarkua. Provoni sërish.");
    }
  }
  async function send() {
    if (!selected || !body.trim() || busy) return;
    setBusy(true);
    setNotice("");
    key.current ??= crypto.randomUUID();
    try {
      const result = await submit({
        conversation_id: selected,
        idempotency_key: key.current,
        body: body.trim(),
        file_ids: [],
      });
      if (result.kind !== "sent") {
        if (result.kind === "conflict") key.current = null;
        if (result.kind === "conversation_closed") setClosed(true);
        setNotice(
          result.kind === "conflict"
            ? "Mesazhi ndryshoi. Kontrolloni bisedën para një dërgimi të ri."
            : result.kind === "conversation_closed"
              ? "Biseda është mbyllur. Mesazhi nuk u dërgua."
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
    <section
      aria-label={orderId ? "Biseda e porosisë" : "Biseda e përgjithshme"}
    >
      <h3>{orderId ? "Biseda e porosisë" : "Biseda e përgjithshme"}</h3>
      {orderId ? (
        <p>
          Bisedë vetëm për këtë porosi ose retushim. Mesazhet nuk ndryshojnë
          udhëzimet zyrtare.
        </p>
      ) : (
        <p>
          Komunikim me klinikën, i ndarë nga porositë. Kërkesat për të dhënat
          personale mund t'i shkruani këtu; përgjigjja në bisedë nuk është
          vendim për ndryshimin e porosisë.
        </p>
      )}
      {conversations && !conversations.items.length && (
        <p>Nuk u gjet bisedë e disponueshme.</p>
      )}
      <Button type="button" onClick={() => void reloadConversations()}>
        Rifresko bisedat
      </Button>
      {!clinic && !orderId && !generalClinicId && (
        <label>
          Klinika
          <select
            value={selected}
            disabled={busy || reading || loadingMessages || loadingOlder}
            onChange={(e) => {
              setLoadingMessages(Boolean(e.target.value));
              setSelected(e.target.value);
              setConnection("waiting");
              setMessages(null);
              setBody("");
              key.current = null;
            }}
          >
            <option value="">Zgjidhni klinikën</option>
            {conversations?.items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.clinic_name}
                {item.unread_count > 0
                  ? ` · ${item.unread_count} të palexuara`
                  : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {!clinic && !orderId && !generalClinicId && conversations?.next_after && (
        <Button type="button" onClick={() => void moreConversations()}>
          Më shumë klinika
        </Button>
      )}
      {(clinic || orderId || generalClinicId) && conversations?.items[0] && (
        <p>{conversations.items[0].unread_count} mesazhe të palexuara</p>
      )}
      {selected && (
        <>
          <p role="status">
            {connection === "offline"
              ? "Pa lidhje. Do të provojmë përsëri."
              : connection === "waiting"
                ? "Duke u lidhur..."
                : "Biseda përditësohet automatikisht."}
          </p>
          <Button
            type="button"
            disabled={loadingMessages}
            onClick={() => void refresh()}
          >
            Përditëso mesazhet
          </Button>
          {messages?.next_before_seq && (
            <Button
              type="button"
              disabled={loadingOlder}
              onClick={() => void older()}
            >
              Mesazhe më të vjetra
            </Button>
          )}
          {messages &&
            firstVisible !== undefined &&
            firstVisible > messages.last_read_seq + 1 && (
              <p>Hapni mesazhet më të vjetra para konfirmimit të leximit.</p>
            )}
          {loadingMessages && <p role="status">Duke ngarkuar mesazhet...</p>}
          {loadingOlder && (
            <p role="status">Duke ngarkuar mesazhet e mëparshme...</p>
          )}
          {typeof IntersectionObserver === "undefined" && (
            <p>Konfirmimi automatik i leximit nuk mbështetet këtu.</p>
          )}
          <ol aria-label="Mesazhet" ref={messageList}>
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
                {message.own && (
                  <div>
                    {!closed && canReply && !message.hidden && (
                      <>
                        <Button
                          type="button"
                          disabled={mutating}
                          onClick={() => {
                            setEditing({
                              id: message.id,
                              revision: message.revision,
                              body: message.body ?? "",
                            });
                            setHistory(null);
                          }}
                        >
                          Ndrysho
                        </Button>
                        <Button
                          type="button"
                          disabled={mutating}
                          onClick={() => void changeMessage(message, "hide")}
                        >
                          Fshih mesazhin
                        </Button>
                      </>
                    )}
                    <Button
                      type="button"
                      onClick={() => void openHistory(message.id)}
                    >
                      Historiku i versioneve
                    </Button>
                    {history?.id === message.id && (
                      <div>
                        <ol aria-label="Historiku i mesazhit">
                          {history.page.versions.map((version) => (
                            <li key={version.version_number}>
                              Versioni {version.version_number} ·{" "}
                              <time dateTime={version.created_at}>
                                {version.created_at}
                              </time>
                              <p>{version.body}</p>
                            </li>
                          ))}
                        </ol>
                        {history.page.next_before_version && (
                          <Button
                            type="button"
                            onClick={() =>
                              void openHistory(
                                message.id,
                                history.page.next_before_version ?? undefined,
                              )
                            }
                          >
                            Versione më të vjetra
                          </Button>
                        )}
                        <Button type="button" onClick={() => setHistory(null)}>
                          Mbyll historikun
                        </Button>
                      </div>
                    )}
                    {editing?.id === message.id && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void changeMessage(message, "edit");
                        }}
                      >
                        <label>
                          Ndrysho mesazhin
                          <textarea
                            value={editing.body}
                            maxLength={100000}
                            disabled={mutating}
                            onChange={(event) =>
                              setEditing({
                                ...editing,
                                body: event.target.value,
                              })
                            }
                          />
                        </label>
                        <Button
                          type="submit"
                          disabled={mutating || !editing.body.trim()}
                        >
                          Ruaj ndryshimin
                        </Button>
                        <Button type="button" onClick={() => setEditing(null)}>
                          Anulo
                        </Button>
                      </form>
                    )}
                  </div>
                )}
                <span
                  aria-hidden="true"
                  data-read-end
                  data-sequence={message.sequence_number}
                  style={{ display: "inline-block", width: 1, height: 1 }}
                />
              </li>
            ))}
          </ol>
          {closed && (
            <p>
              Porosia është dorëzuar; biseda mund të lexohet, por jo të marrë
              mesazhe të reja.
            </p>
          )}
          {canReply && !closed && (
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
