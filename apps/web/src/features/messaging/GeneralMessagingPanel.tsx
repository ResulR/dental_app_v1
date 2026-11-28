import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GeneralConversationPageSchema,
  GeneralMessagePageSchema,
  MessageHistoryResultSchema,
} from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
import { MessageSendForm } from "./MessageSendForm.js";
import { appendMessageHistory } from "./message-history-page.js";
import {
  appendConversationPage,
  catchUpMessages,
  createReadFlight,
  hasAuthorizedConversation,
  contiguousReadThrough,
  confirmsMutatedMessage,
  mergeMessagePage,
} from "./message-sync.js";
import {
  generalConversations,
  generalMessages,
  markGeneralRead,
  orderConversation,
  orderMessages,
  markOrderRead,
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
  accountId,
}: {
  clinic: boolean;
  canReply: boolean;
  orderId?: string;
  generalClinicId?: string;
  accountId: string;
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
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState("");
  const [connection, setConnection] = useState<
    "connected" | "waiting" | "offline"
  >("waiting");
  const latestPage = useRef<Messages | null>(null);
  const latestConversations = useRef<Conversations | null>(null);
  const messageList = useRef<HTMLOListElement>(null);
  const seen = useRef<{
    conversationId: string;
    sequences: Set<number>;
  } | null>(null);
  const readPending = useRef(createReadFlight());
  const conversationEpoch = useRef(0);
  const selectionEpoch = useRef(0);
  const historyEpoch = useRef(0);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const morePending = useRef(false);
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
    const epochRef = conversationEpoch;
    const epoch = ++epochRef.current;
    void fetchConversations({}, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted && epoch === conversationEpoch.current) {
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
        if (!controller.signal.aborted && epoch === conversationEpoch.current)
          setNotice("Bisedat nuk u ngarkuan. Provoni sërish.");
      });
    return () => {
      controller.abort();
      if (epochRef.current === epoch) epochRef.current++;
    };
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
    const epoch = ++conversationEpoch.current;
    setNotice("");
    const selectedAtStart = selected;
    const selectionAtStart = selectionEpoch.current;
    const knownClinic = latestConversations.current?.items.find(
      (item) => item.id === selectedAtStart,
    )?.clinic_id;
    try {
      const page = selectedAtStart
        ? await loadConversationCounts(selectedAtStart)
        : await fetchConversations({});
      if (
        epoch !== conversationEpoch.current ||
        selectionAtStart !== selectionEpoch.current
      )
        return;
      setConversations(page);
      if (page.closed !== undefined) setClosed(page.closed);
      if (
        selectedAtStart &&
        !hasAuthorizedConversation(page, selectedAtStart, knownClinic)
      ) {
        selectionEpoch.current++;
        setSelected("");
        setMessages(null);
        closeHistory();
        setEditing(null);
        setNotice("Biseda nuk është më e disponueshme për këtë llogari.");
      } else if (
        !selectedAtStart &&
        (clinic || orderId || generalClinicId) &&
        page.items.length === 1
      ) {
        setSelected(page.items[0]!.id);
      }
    } catch {
      if (
        epoch !== conversationEpoch.current ||
        selectionAtStart !== selectionEpoch.current
      )
        return;
      setConversations(null);
      setMessages(null);
      closeHistory();
      setEditing(null);
      setConnection("offline");
      setNotice("Bisedat nuk u ngarkuan ose lejet ndryshuan.");
    }
  }
  async function moreConversations() {
    if (!conversations?.next_after || morePending.current) return;
    morePending.current = true;
    const epoch = conversationEpoch.current;
    const cursor = conversations.next_after;
    setLoadingConversations(true);
    try {
      const page = await fetchConversations({ after: cursor });
      if (epoch !== conversationEpoch.current) return;
      setConversations((current) =>
        appendConversationPage(current, conversations, page, cursor),
      );
    } catch {
      if (epoch === conversationEpoch.current)
        setNotice("Klinikat e tjera nuk u ngarkuan.");
    } finally {
      morePending.current = false;
      setLoadingConversations(false);
    }
  }
  async function refresh() {
    if (!selected) return;
    const epoch = selectionEpoch.current;
    setNotice("");
    setLoadingMessages(true);
    try {
      const current = latestPage.current;
      if (current?.conversation_id === selected) {
        const caughtUp = await catchUpMessages(
          current,
          (query) => fetchMessages(query),
          (page) =>
            setMessages((previous) =>
              epoch === selectionEpoch.current &&
              previous?.conversation_id === selected
                ? mergeMessagePage(previous, page)
                : previous,
            ),
        );
        if (epoch === selectionEpoch.current)
          setConnection(caughtUp ? "connected" : "waiting");
      } else {
        const page = await fetchMessages({ conversation_id: selected });
        if (epoch === selectionEpoch.current) {
          setMessages(page);
          setConnection("connected");
        }
      }
    } catch {
      if (epoch === selectionEpoch.current) {
        setMessages(null);
        closeHistory();
        setEditing(null);
        setNotice("Mesazhet nuk u ngarkuan ose lejet ndryshuan.");
      }
    } finally {
      if (epoch === selectionEpoch.current) setLoadingMessages(false);
    }
  }
  async function older() {
    if (!selected || !messages?.next_before_seq || loadingOlder) return;
    const epoch = selectionEpoch.current;
    setLoadingOlder(true);
    try {
      const page = await fetchMessages({
        conversation_id: selected,
        before_seq: messages.next_before_seq,
      });
      setMessages((previous) =>
        epoch === selectionEpoch.current &&
        previous?.conversation_id === page.conversation_id
          ? mergeMessagePage(previous, page, true)
          : previous,
      );
    } catch {
      if (epoch === selectionEpoch.current)
        setNotice("Mesazhet e mëparshme nuk u ngarkuan.");
    } finally {
      if (epoch === selectionEpoch.current) setLoadingOlder(false);
    }
  }
  const firstVisible = messages?.messages[0]?.sequence_number;
  useEffect(() => {
    if (!selected || !messages || typeof IntersectionObserver === "undefined")
      return;
    if (seen.current?.conversationId !== selected)
      seen.current = { conversationId: selected, sequences: new Set() };
    let active = true;
    let ownRead: symbol | null = null;
    const pending = readPending.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (document.hidden || pending.busy || !active) return;
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
        const token = pending.begin();
        if (token === null) return;
        ownRead = token;
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
            if (pending.finish(token)) {
              setReading(false);
            }
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
      if (ownRead !== null && pending.finish(ownRead)) {
        setReading(false);
      }
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
        const caughtUp = await catchUpMessages(
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
        setConnection(caughtUp ? "connected" : "waiting");
      } catch {
        if (active) {
          setConnection("offline");
          setMessages(null);
          setConversations(null);
          closeHistory();
          setEditing(null);
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
    const epoch = selectionEpoch.current;
    const conversationId = selected;
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
      if (epoch !== selectionEpoch.current) return;
      if (result.kind !== "updated") {
        if (result.kind === "closed") setClosed(true);
        setNotice(
          result.kind === "closed"
            ? "Biseda është mbyllur; ndryshimi nuk u ruajt."
            : "Mesazhi ndryshoi në një sesion tjetër. Ringarkoni dhe provoni sërish.",
        );
        return;
      }
      const page = await fetchMessages({
        conversation_id: conversationId,
        before_seq: message.sequence_number + 1,
      });
      if (epoch !== selectionEpoch.current) return;
      if (
        result.revision === null ||
        !confirmsMutatedMessage(
          page,
          conversationId,
          message.id,
          result.revision,
        )
      )
        throw new Error("MESSAGE_MUTATION_RECEIPT_MISMATCH");
      setEditing(null);
      setMessages((previous) =>
        previous?.conversation_id === conversationId
          ? mergeMessagePage(previous, page, true)
          : previous,
      );
    } catch {
      if (epoch !== selectionEpoch.current) return;
      setMessages(null);
      closeHistory();
      setEditing(null);
      setNotice(
        "Nuk dihet nëse ndryshimi u ruajt ose lejet ndryshuan. Mesazhet u fshehën; rifreskoni bisedën para se të provoni sërish.",
      );
    } finally {
      setMutating(false);
    }
  }
  function closeHistory() {
    historyEpoch.current++;
    setHistory(null);
  }
  async function openHistory(messageId: string, beforeVersion?: number) {
    if (!selected) return;
    const epoch = selectionEpoch.current;
    const request = ++historyEpoch.current;
    try {
      const page = await textMessageHistory(orderId ? "order" : "general", {
        conversation_id: selected,
        message_id: messageId,
        ...(beforeVersion ? { before_version: beforeVersion } : {}),
      });
      if (epoch !== selectionEpoch.current || request !== historyEpoch.current)
        return;
      setHistory((previous) =>
        previous?.id === messageId && beforeVersion
          ? {
              id: messageId,
              page: appendMessageHistory(previous.page, page, beforeVersion),
            }
          : { id: messageId, page },
      );
    } catch {
      if (
        epoch === selectionEpoch.current &&
        request === historyEpoch.current
      ) {
        closeHistory();
        setMessages(null);
        setEditing(null);
        setNotice(
          "Historiku ose lejet nuk u verifikuan. Mesazhet u fshehën; rifreskoni bisedën.",
        );
      }
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
            disabled={mutating || reading || loadingMessages || loadingOlder}
            onChange={(e) => {
              selectionEpoch.current++;
              setLoadingMessages(Boolean(e.target.value));
              setSelected(e.target.value);
              setConnection("waiting");
              setMessages(null);
              closeHistory();
              setEditing(null);
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
        <Button
          type="button"
          disabled={loadingConversations}
          onClick={() => void moreConversations()}
        >
          {loadingConversations ? "Duke ngarkuar..." : "Më shumë klinika"}
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
                            closeHistory();
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
                        <Button type="button" onClick={closeHistory}>
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
          <MessageSendForm
            key={`${accountId}:${selected}`}
            accountId={accountId}
            conversationId={selected}
            clinicId={
              conversations?.items.find((item) => item.id === selected)
                ?.clinic_id ?? ""
            }
            {...(orderId ? { orderId } : {})}
            canReply={canReply}
            closed={closed}
            onSent={() =>
              void refresh().catch(() =>
                setNotice(
                  "Mesazhi u verifikua, por lista nuk u përditësua. Rifreskoni bisedën.",
                ),
              )
            }
          />
        </>
      )}
      {notice && <p role="alert">{notice}</p>}
    </section>
  );
}
