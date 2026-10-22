import { useCallback, useEffect, useState } from "react";
import type { MessagingInboxPageSchema } from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
import {
  messagingInbox,
  generalConversations,
  orderConversation,
} from "./general-api.js";
import { GeneralMessagingPanel } from "./GeneralMessagingPanel.js";
type Page = ReturnType<typeof MessagingInboxPageSchema.parse>;
type Item = Page["items"][number];
export function MessagingInboxPanel({
  permissions,
}: {
  permissions: ReadonlyArray<string>;
}) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [filters, setFilters] = useState<{
    search: string;
    kind: string;
    unreadOnly: boolean;
  }>({ search: "", kind: "", unreadOnly: false });
  const [page, setPage] = useState<Page | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const query = useCallback(
    (cursor?: Page) => ({
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.unreadOnly ? { unread_only: true } : {}),
      ...(cursor?.next_before_at && cursor.next_before_id
        ? { before_at: cursor.next_before_at, before_id: cursor.next_before_id }
        : {}),
    }),
    [filters],
  );
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const result = await messagingInbox(query(), signal);
      let scoped: Item | null = null;
      if (
        selected &&
        !result.items.some(
          (item) => item.conversation_id === selected.conversation_id,
        )
      ) {
        if (selected.kind === "order" && selected.order_id) {
          const current = await orderConversation(
            { order_id: selected.order_id },
            signal,
          );
          scoped = {
            ...selected,
            closed: current.closed,
            unread_count: current.unread_count,
          };
        } else if (selected.kind === "general") {
          const current = await generalConversations(
            { clinic_id: selected.clinic_id },
            signal,
          );
          scoped = current.items.some(
            (item) => item.id === selected.conversation_id,
          )
            ? selected
            : null;
        }
      }
      if (signal?.aborted) return;
      setPage(result);
      setNotice("");
      setSelected((previous) => {
        if (!previous) return null;
        const next =
          result.items.find(
            (item) => item.conversation_id === previous.conversation_id,
          ) ?? scoped;
        return next &&
          next.unread_count === previous.unread_count &&
          next.closed === previous.closed &&
          next.activity_at === previous.activity_at
          ? previous
          : next;
      });
    },
    [query, selected],
  );
  useEffect(() => {
    const controller = new AbortController();
    const initial = window.setTimeout(() => {
      void refresh(controller.signal).catch(() => {
        if (!controller.signal.aborted) {
          setPage(null);
          setSelected(null);
          setNotice("Bisedat nuk u ngarkuan. Kontrolloni lidhjen dhe lejet.");
        }
      });
    }, 0);
    const timer = window.setInterval(() => {
      if (!document.hidden && navigator.onLine)
        void refresh(controller.signal).catch(() => {
          if (!controller.signal.aborted) {
            setPage(null);
            setSelected(null);
            setNotice("Lidhja u ndërpre ose lejet ndryshuan. Provoni sërish.");
          }
        });
    }, 10_000);
    const resume = () => {
      if (!document.hidden && navigator.onLine)
        void refresh(controller.signal).catch(() => {
          if (!controller.signal.aborted) {
            setPage(null);
            setSelected(null);
            setNotice("Bisedat nuk u ngarkuan.");
          }
        });
    };
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      controller.abort();
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [refresh]);
  async function more() {
    if (!page?.next_before_at || loading) return;
    setLoading(true);
    try {
      const result = await messagingInbox(query(page));
      setPage({ ...result, items: [...page.items, ...result.items] });
    } catch {
      setNotice("Bisedat e mëparshme nuk u ngarkuan.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section aria-label="Kutia e bisedave">
      <h3>Kutia e bisedave</h3>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSelected(null);
          setPage(null);
          setFilters({ search: search.trim(), kind, unreadOnly });
        }}
      >
        <label>
          Kërko klinikën ose numrin e porosisë
          <input
            value={search}
            maxLength={80}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          Lloji
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="">Të gjitha</option>
            {permissions.includes("messaging.general.read") && (
              <option value="general">Të përgjithshme</option>
            )}
            {import.meta.env.VITE_DENTAL_LAB_ORDER_MESSAGING_ENABLED ===
              "true" &&
              permissions.includes("messaging.order.read") && (
                <option value="order">Porosi dhe retushime</option>
              )}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => setUnreadOnly(event.target.checked)}
          />{" "}
          Vetëm të palexuara
        </label>
        <Button type="submit">Filtro</Button>
      </form>
      <Button
        type="button"
        onClick={() =>
          void refresh().catch(() => {
            setPage(null);
            setSelected(null);
            setNotice("Bisedat nuk u ngarkuan.");
          })
        }
      >
        Rifresko
      </Button>
      {!page && !notice && <p role="status">Duke ngarkuar bisedat...</p>}
      {notice && <p role="alert">{notice}</p>}
      {page && !page.items.length && <p>Nuk u gjet bisedë.</p>}
      <ul>
        {page?.items.map((item) => (
          <li key={item.conversation_id}>
            <Button type="button" onClick={() => setSelected(item)}>
              {item.clinic_name} ·{" "}
              {item.kind === "order"
                ? "Porosia nr. " + item.order_number
                : "E përgjithshme"}
              {item.unread_count
                ? " · " + item.unread_count + " të palexuara"
                : ""}
              {item.closed ? " · E mbyllur" : ""}
            </Button>
          </li>
        ))}
      </ul>
      {page?.next_before_at && (
        <Button type="button" disabled={loading} onClick={() => void more()}>
          {loading ? "Duke ngarkuar..." : "Më shumë biseda"}
        </Button>
      )}
      {selected && (
        <div>
          <h4>
            {selected.clinic_name} ·{" "}
            {selected.kind === "order"
              ? "Porosia nr. " + selected.order_number
              : "E përgjithshme"}
          </h4>
          <Button type="button" onClick={() => setSelected(null)}>
            Mbyll bisedën
          </Button>
          <GeneralMessagingPanel
            key={selected.conversation_id}
            clinic={false}
            canReply={permissions.includes(
              selected.kind === "order"
                ? "messaging.order.reply"
                : "messaging.general.reply",
            )}
            {...(selected.kind === "order" && selected.order_id
              ? { orderId: selected.order_id }
              : { generalClinicId: selected.clinic_id })}
          />
        </div>
      )}
    </section>
  );
}
