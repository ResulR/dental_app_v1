import { useEffect, useRef, useState } from "react";
import type { ActionInboxPage } from "@dental-lab/contracts";
import { createActionInboxClient } from "./action-inbox-api.js";
import { OrderReviewPanel } from "./OrderReviewPanel.js";
import { OrderLifecycleActions } from "./OrderLifecycleActions.js";
import { OrderModificationReview } from "./OrderModificationReview.js";
import { OrderRequestActions } from "./OrderRequestActions.js";
import { ClinicReviewPanel } from "../clinics/index.js";
import { Button } from "../../shared/Button.js";
const api = createActionInboxClient();
const labels = {
  new_order: "Porosi e re",
  correction_resubmitted: "Korrigjim i ridërguar",
  retouch: "Retushim / rifabrikim",
  modification: "Kërkesë ndryshimi",
  cancellation: "Kërkesë anulimi",
  registration: "Regjistrim klinike",
};
export function ActionInboxPanel() {
  const [page, setPage] = useState<ActionInboxPage | null>(null),
    [selected, setSelected] = useState<ActionInboxPage["items"][number] | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [],
  );
  async function load(next = false) {
    if (pending.current) return;
    const c = new AbortController();
    pending.current = c;
    setBusy(true);
    setSelected(null);
    setMessage("");
    const timer = setTimeout(() => c.abort(), 8000);
    try {
      const result = await api.list(
        next && page?.next_after ? { after: page.next_after } : {},
        c.signal,
      );
      if (!c.signal.aborted) setPage(result);
    } catch {
      if (pending.current === c) {
        setPage(null);
        setMessage("Veprimet nuk u verifikuan. Kontrolloni lidhjen dhe lejet.");
      }
    } finally {
      clearTimeout(timer);
      if (pending.current === c) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  function finished(text: string) {
    setPage(null);
    setSelected(null);
    setMessage(text);
  }
  return (
    <section aria-label="Veprime për trajtim">
      <h2>Veprime për trajtim</h2>
      <p>
        Hapja ose leximi nuk e përfundon veprimin. Lista bazohet te kërkesat
        ende në pritje. Retushimet shfaqen me përparësi. Ringarkoni pas
        vendimit.
      </p>
      <Button disabled={busy} onClick={() => void load()}>
        Ringarko veprimet
      </Button>
      {page && (
        <ul>
          {page.items.map((item) => (
            <li key={item.kind + item.id}>
              {labels[item.kind]} ·{" "}
              {item.number ? "Nr. " + item.number + " · " : ""}
              {item.clinic_name} · {item.occurred_at}
              {item.rank < 2 ? " · Prioritet" : ""}{" "}
              <Button disabled={busy} onClick={() => setSelected(item)}>
                Trajto
              </Button>
            </li>
          ))}
        </ul>
      )}
      {page?.items.length === 0 && (
        <p>Nuk ka veprime në pritje në këtë faqe.</p>
      )}
      {page?.next_after && (
        <Button disabled={busy} onClick={() => void load(true)}>
          Faqja tjetër
        </Button>
      )}
      {selected && page && (
        <div key={selected.kind + selected.id + ":" + selected.revision}>
          {selected.kind === "registration" ? (
            <ClinicReviewPanel
              initialClinic={{
                id: selected.id,
                name: selected.clinic_name,
                revision: selected.revision,
              }}
            />
          ) : (
            selected.order_id && (
              <>
                {["new_order", "correction_resubmitted", "retouch"].includes(
                  selected.kind,
                ) && (
                  <>
                    <OrderReviewPanel
                      permissions={page.permissions}
                      orderId={selected.order_id}
                    />
                    <OrderLifecycleActions
                      orderId={selected.order_id}
                      clinic={false}
                      permissions={page.permissions}
                      onFinished={finished}
                    />
                  </>
                )}
                {selected.kind === "modification" && (
                  <OrderModificationReview
                    orderId={selected.order_id}
                    clinic={false}
                    onFinished={finished}
                  />
                )}
                {selected.kind === "cancellation" && (
                  <OrderRequestActions
                    orderId={selected.order_id}
                    clinic={false}
                    permissions={page.permissions}
                    onFinished={finished}
                  />
                )}
              </>
            )
          )}
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
