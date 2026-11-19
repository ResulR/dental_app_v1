import { useEffect, useRef, useState } from "react";
import type {
  DeliveryPriorityContext,
  DeliveryPriorityHistoryPage,
} from "@dental-lab/contracts";
import { createDeliveryPriorityClient } from "./delivery-priority-api.js";
import { appendDeliveryPlanHistory } from "./delivery-plan-history.js";
import { Button } from "../../shared/Button.js";
const client = createDeliveryPriorityClient();
export function DeliveryPriorityPanel({ orderId }: { orderId: string }) {
  const [context, setContext] = useState<DeliveryPriorityContext | null>(null);
  const [history, setHistory] = useState<DeliveryPriorityHistoryPage | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
      setContext(null);
      setHistory(null);
    },
    [orderId],
  );
  async function run(work: (signal: AbortSignal) => Promise<void>) {
    if (pending.current) return;
    const c = new AbortController();
    pending.current = c;
    setBusy(true);
    setMessage("");
    const timer = setTimeout(() => c.abort(), 8000);
    try {
      await work(c.signal);
    } catch {
      if (pending.current === c) {
        setContext(null);
        setHistory(null);
        setMessage(
          "Rezultati nuk u verifikua. Ringarkoni prioritetin; mos e përsërisni automatikisht.",
        );
      }
    } finally {
      clearTimeout(timer);
      if (pending.current === c) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  function load() {
    void run(async (signal) => {
      const value = await client.context(orderId, signal);
      if (signal.aborted) return;
      setContext(value);
      setHistory({
        order_id: value.order_id,
        logistics_revision: value.logistics_revision,
        items: value.recent_changes,
        next_before_event_id: value.more_history
          ? value.recent_changes[value.recent_changes.length - 1]!.id
          : null,
      });
    });
  }
  function update(priority: boolean) {
    if (
      !context ||
      ["delivered", "rejected", "cancelled"].includes(context.status)
    )
      return;
    void run(async (signal) => {
      const result = await client.update(
        {
          order_id: context.order_id,
          expected_version_id: context.version_id,
          expected_order_revision: context.order_revision,
          expected_logistics_revision: context.logistics_revision,
          priority,
        },
        signal,
      );
      if (signal.aborted) return;
      setContext(null);
      setHistory(null);
      setMessage(
        result.kind === "updated"
          ? "Prioriteti u ruajt në historik. Ringarkoni pamjen."
          : result.kind === "unchanged"
            ? "Prioriteti nuk ndryshoi. Ringarkoni pamjen."
            : result.kind === "closed"
              ? "Porosia është mbyllur; prioriteti nuk ndryshoi."
              : "Versioni ndryshoi; ringarkoni pamjen.",
      );
    });
  }
  function loadOlder() {
    if (!history) return;
    const current = history;
    const cursor = current.next_before_event_id;
    if (!cursor) return;
    void run(async (signal) => {
      const page = await client.history(
        {
          order_id: current.order_id,
          expected_logistics_revision: current.logistics_revision,
          before_event_id: cursor,
        },
        signal,
      );
      if (signal.aborted) return;
      const merged = appendDeliveryPlanHistory(current, page, cursor);
      if (!merged) throw new Error("DELIVERY_PRIORITY_STALE_HISTORY");
      setHistory(merged);
    });
  }
  return (
    <section aria-label="Prioriteti manual" aria-busy={busy}>
      <h4>Prioriteti manual</h4>
      <Button disabled={busy} onClick={load}>
        Ngarko prioritetin
      </Button>
      {context && (
        <>
          <p>
            {context.priority ? "Prioritet aktiv" : "Pa prioritet manual"} · r
            {context.order_revision}
          </p>
          {!["delivered", "rejected", "cancelled"].includes(context.status) && (
            <Button disabled={busy} onClick={() => update(!context.priority)}>
              {context.priority ? "Hiq prioritetin" : "Vendos prioritet"}
            </Button>
          )}
          <h5>Ndryshimet e fundit</h5>
          {history?.items.length ? (
            <ol>
              {history.items.map((change) => (
                <li key={change.id}>
                  {change.occurred_at}: {change.before ? "Prioritet" : "Normal"}{" "}
                  → {change.after ? "Prioritet" : "Normal"}
                </li>
              ))}
            </ol>
          ) : (
            <p>Nuk ka ndryshime të regjistruara.</p>
          )}
          {history?.next_before_event_id && (
            <Button disabled={busy} onClick={loadOlder}>
              Shfaq ndryshimet më të vjetra
            </Button>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
