import { useEffect, useRef, useState } from "react";
import type { DeliveryPriorityContext } from "@dental-lab/contracts";
import { createDeliveryPriorityClient } from "./delivery-priority-api.js";
import { Button } from "../../shared/Button.js";
const client = createDeliveryPriorityClient();
export function DeliveryPriorityPanel({ orderId }: { orderId: string }) {
  const [context, setContext] = useState<DeliveryPriorityContext | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [],
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
      if (!signal.aborted) setContext(value);
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
          {context.recent_changes.length ? (
            <ol>
              {context.recent_changes.map((change) => (
                <li key={change.id}>
                  {change.occurred_at}: {change.before ? "Prioritet" : "Normal"}{" "}
                  → {change.after ? "Prioritet" : "Normal"}
                </li>
              ))}
            </ol>
          ) : (
            <p>Nuk ka ndryshime të regjistruara.</p>
          )}
          {context.more_history && (
            <p>Ka ndryshime më të vjetra; shfaqen vetëm 20 të fundit.</p>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
