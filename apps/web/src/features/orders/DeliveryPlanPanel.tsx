import { useEffect, useRef, useState } from "react";
import type { DeliveryPlanContext } from "@dental-lab/contracts";
import { createDeliveryPlanClient } from "./delivery-plan-api.js";
import { Button } from "../../shared/Button.js";
const client = createDeliveryPlanClient();
export function DeliveryPlanPanel({ orderId }: { orderId: string }) {
  const [context, setContext] = useState<DeliveryPlanContext | null>(null);
  const [date, setDate] = useState("");
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
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setMessage("");
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      await work(controller.signal);
    } catch {
      if (pending.current === controller) {
        setContext(null);
        setMessage(
          "Rezultati nuk u verifikua. Ringarkoni planifikimin; mos e përsërisni ndryshimin automatikisht.",
        );
      }
    } finally {
      clearTimeout(timer);
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  function load() {
    void run(async (signal) => {
      const value = await client.context(orderId, signal);
      if (pending.current === null || signal.aborted) return;
      setContext(value);
      setDate(value.planned_delivery_date ?? "");
    });
  }
  function save() {
    if (
      !context ||
      ![
        "pending",
        "correction_requested",
        "accepted",
        "manufacturing",
        "completed",
      ].includes(context.status)
    )
      return;
    void run(async (signal) => {
      const result = await client.update(
        {
          order_id: context.order_id,
          expected_version_id: context.version_id,
          expected_order_revision: context.order_revision,
          expected_logistics_revision: context.logistics_revision,
          planned_delivery_date: date || null,
        },
        signal,
      );
      if (signal.aborted) return;
      setContext(null);
      setMessage(
        result.kind === "updated"
          ? "Data u ruajt dhe u regjistrua në historik. Ringarkoni planifikimin."
          : result.kind === "unchanged"
            ? "Data nuk ndryshoi. Ringarkoni planifikimin."
            : result.kind === "closed"
              ? "Porosia është mbyllur; data nuk ndryshoi."
              : "Versioni ndryshoi; ringarkoni planifikimin.",
      );
    });
  }
  return (
    <section aria-label="Planifikimi i dorëzimit" aria-busy={busy}>
      <h4>Data e planifikuar nga laboratori</h4>
      <Button disabled={busy} onClick={load}>
        Ngarko planifikimin
      </Button>
      {context && (
        <>
          <p>
            Data e kërkuar: {context.requested_delivery_date}. Data e
            planifikuar: {context.planned_delivery_date ?? "Ende pa plan"}.
          </p>
          <p>
            Statusi: {context.status}; rishikimi i porosisë{" "}
            {context.order_revision}, logjistikës {context.logistics_revision}.
          </p>
          {!["delivered", "rejected", "cancelled"].includes(context.status) && (
            <fieldset disabled={busy}>
              <label>
                Data e re e planifikuar{" "}
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>
              <Button onClick={save}>Ruaj datën</Button>
              <Button onClick={() => setDate("")}>
                Hiq datën e planifikuar
              </Button>
            </fieldset>
          )}
          <h5>Ndryshimet e fundit të planifikimit</h5>
          {context.recent_changes.length ? (
            <ol>
              {context.recent_changes.map((change) => (
                <li key={change.id}>
                  {change.occurred_at}: {change.before ?? "pa plan"} →{" "}
                  {change.after ?? "pa plan"}
                </li>
              ))}
            </ol>
          ) : (
            <p>Nuk ka ndryshime të regjistruara.</p>
          )}
          {context.more_history && (
            <p>
              Ekzistojnë edhe ndryshime më të vjetra; kjo pamje tregon vetëm 20
              të fundit.
            </p>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
