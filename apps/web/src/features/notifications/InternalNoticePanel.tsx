import { useCallback, useEffect, useState } from "react";
import {
  InternalNoticePageSchema,
  InternalNoticeReadResultSchema,
} from "@dental-lab/contracts";
import { ClinicReviewPanel } from "../clinics/index.js";
import { GeneralMessagingPanel } from "../messaging/index.js";
import {
  OrderEditPanel,
  OrderReviewPanel,
  OrderRequestActions,
  OrderModificationReview,
} from "../orders/index.js";
import type { EffectivePermissionsSchema } from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
type Page = ReturnType<typeof InternalNoticePageSchema.parse>;
type Item = Page["items"][number];
async function post(path: string, body: unknown, signal?: AbortSignal) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error("NOTICES_UNAVAILABLE");
  return response.json();
}
export function InternalNoticePanel({
  permissions,
  clinic,
}: {
  clinic: boolean;
  permissions: ReturnType<
    typeof EffectivePermissionsSchema.parse
  >["permissions"];
}) {
  const [page, setPage] = useState<Page | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const result = InternalNoticePageSchema.parse(
      await post("/api/v1/notifications/internal/list", {}, signal),
    );
    if (signal?.aborted) return null;
    setPage(result);
    setNotice("");
    setSelected((previous) =>
      previous
        ? (result.items.find((item) => item.id === previous.id) ?? null)
        : null,
    );
    return result;
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const initial = window.setTimeout(() => {
      void refresh(controller.signal).catch(() => {
        if (!controller.signal.aborted) {
          setPage(null);
          setSelected(null);
          setNotice("Njoftimet nuk u ngarkuan ose lejet ndryshuan.");
        }
      });
    }, 0);
    const timer = window.setInterval(() => {
      if (!document.hidden && navigator.onLine)
        void refresh(controller.signal).catch(() => {
          if (!controller.signal.aborted) {
            setPage(null);
            setSelected(null);
            setNotice("Njoftimet nuk u verifikuan.");
          }
        });
    }, 15000);
    return () => {
      controller.abort();
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);
  async function older() {
    if (!page?.next_before_at || !page.next_before_id || busy) return;
    setBusy(true);
    try {
      const current = await refresh();
      if (!current) return;
      let cursor = current;
      const items = [...current.items];
      const target = page.items.length + 50;
      while (
        items.length < target &&
        cursor.next_before_at &&
        cursor.next_before_id
      ) {
        cursor = InternalNoticePageSchema.parse(
          await post("/api/v1/notifications/internal/list", {
            before_at: cursor.next_before_at,
            before_id: cursor.next_before_id,
          }),
        );
        items.push(...cursor.items);
      }
      setPage({ ...cursor, unread_count: current.unread_count, items });
    } catch {
      setPage(null);
      setSelected(null);
      setNotice("Lejet ose njoftimet nuk u verifikuan.");
    } finally {
      setBusy(false);
    }
  }
  async function open(item: Item) {
    if (busy) return;
    setBusy(true);
    try {
      InternalNoticeReadResultSchema.parse(
        await post("/api/v1/notifications/internal/read", { id: item.id }),
      );
      // Refresh rechecks the current owner session and destination.
      const current = await refresh();
      const verified = current?.items.find(
        (candidate) => candidate.id === item.id,
      );
      if (!verified) throw new Error("NOTICES_UNAVAILABLE");
      setSelected(verified);
      setConversationOpen(false);
    } catch {
      setPage(null);
      setSelected(null);
      setNotice("Njoftimi nuk u verifikua. Provoni sërish.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Njoftimet e brendshme">
      <h2>Njoftimet e brendshme</h2>
      <p>Leximi i njoftimit nuk e miraton regjistrimin.</p>
      <Button
        type="button"
        disabled={busy}
        onClick={() =>
          void refresh().catch(() => {
            setPage(null);
            setSelected(null);
            setNotice("Njoftimet nuk u verifikuan.");
          })
        }
      >
        Rifresko
      </Button>
      {notice && <p role="alert">{notice}</p>}
      {!page && !notice && <p role="status">Duke ngarkuar...</p>}
      {page && <p>{page.unread_count} të palexuara</p>}
      <ul>
        {page?.items.map((item) => (
          <li key={item.id}>
            {
              {
                clinic_registered: "Kërkesë regjistrimi",
                order_submitted: "Porosi e re",
                correction_resubmitted: "Korrigjim i ridërguar",
                correction_requested: "Korrigjim i kërkuar",
                cancellation_requested: "Kërkesë anulimi",
                modification_requested: "Kërkesë ndryshimi",
                retouch_requested: "Retushim i kërkuar",
                message_created: "Mesazh i ri",
              }[item.kind]
            }{" "}
            · {item.clinic_name} ·{" "}
            <time dateTime={item.created_at}>{item.created_at}</time>
            {item.read_at ? " · Lexuar" : " · I palexuar"}
            <Button
              type="button"
              disabled={busy}
              onClick={() => void open(item)}
            >
              {item.kind === "clinic_registered"
                ? "Shqyrto klinikën"
                : item.kind === "message_created"
                  ? "Shiko njoftimin"
                  : "Shqyrto porosinë"}
            </Button>
          </li>
        ))}
      </ul>
      {page?.next_before_at && (
        <Button type="button" disabled={busy} onClick={() => void older()}>
          Më shumë
        </Button>
      )}
      {selected && (
        <div>
          <Button type="button" onClick={() => setSelected(null)}>
            Mbyll
          </Button>
          {selected.kind === "message_created" ? (
            selected.conversation_id ? (
              <div>
                <p>
                  Leximi i këtij njoftimi nuk i shënon mesazhet e bisedës si të
                  lexuara.
                </p>
                <Button type="button" onClick={() => setConversationOpen(true)}>
                  Hap bisedën
                </Button>
                {conversationOpen && (
                  <GeneralMessagingPanel
                    key={selected.conversation_id}
                    clinic={clinic}
                    canReply={
                      clinic ||
                      permissions.includes(
                        selected.order_id
                          ? "messaging.order.reply"
                          : "messaging.general.reply",
                      )
                    }
                    {...(selected.order_id
                      ? { orderId: selected.order_id }
                      : clinic
                        ? {}
                        : { generalClinicId: selected.clinic_id })}
                  />
                )}
              </div>
            ) : (
              <p role="alert">Biseda nuk u verifikua.</p>
            )
          ) : selected.kind === "clinic_registered" ? (
            <ClinicReviewPanel
              key={selected.id}
              initialClinic={{
                id: selected.clinic_id,
                name: selected.clinic_name,
                revision: selected.clinic_revision,
              }}
            />
          ) : selected.order_id ? (
            <div key={selected.id}>
              {selected.kind === "cancellation_requested" ? (
                <OrderRequestActions
                  orderId={selected.order_id}
                  clinic={false}
                  permissions={permissions}
                  onFinished={() =>
                    void refresh().catch(() =>
                      setNotice("Njoftimet nuk u verifikuan."),
                    )
                  }
                />
              ) : selected.kind === "modification_requested" ? (
                <OrderModificationReview
                  orderId={selected.order_id}
                  clinic={false}
                  onFinished={() =>
                    void refresh().catch(() =>
                      setNotice("Njoftimet nuk u verifikuan."),
                    )
                  }
                />
              ) : selected.kind === "correction_requested" && clinic ? (
                <OrderEditPanel
                  orderId={selected.order_id}
                  clinic
                  permissions={permissions}
                  onFinished={(text) => {
                    void refresh()
                      .then(() => setNotice(text))
                      .catch(() => {
                        setSelected(null);
                        setNotice("Njoftimet nuk u verifikuan.");
                      });
                  }}
                />
              ) : (
                <OrderReviewPanel
                  orderId={selected.order_id}
                  permissions={permissions}
                />
              )}
            </div>
          ) : (
            <p role="alert">Porosia nuk u verifikua.</p>
          )}
        </div>
      )}
    </section>
  );
}
