import { useCallback, useEffect, useState } from "react";
import {
  InternalNoticePageSchema,
  InternalNoticeReadResultSchema,
} from "@dental-lab/contracts";
import { ClinicReviewPanel } from "../clinics/index.js";
import {
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
}: {
  permissions: ReturnType<
    typeof EffectivePermissionsSchema.parse
  >["permissions"];
}) {
  const [page, setPage] = useState<Page | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const result = InternalNoticePageSchema.parse(
      await post("/api/v1/notifications/internal/list", {}, signal),
    );
    if (signal?.aborted) return;
    setPage(result);
    setNotice("");
    setSelected((previous) =>
      previous
        ? (result.items.find((item) => item.id === previous.id) ?? previous)
        : null,
    );
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
      const result = InternalNoticePageSchema.parse(
        await post("/api/v1/notifications/internal/list", {
          before_at: page.next_before_at,
          before_id: page.next_before_id,
        }),
      );
      setPage({ ...result, items: [...page.items, ...result.items] });
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
      await refresh();
      setSelected(item);
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
                cancellation_requested: "Kërkesë anulimi",
                modification_requested: "Kërkesë ndryshimi",
                retouch_requested: "Retushim i kërkuar",
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
          {selected.kind === "clinic_registered" ? (
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
