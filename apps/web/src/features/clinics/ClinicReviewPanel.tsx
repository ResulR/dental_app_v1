import { ClinicProfilePanel } from "./ClinicProfilePanel.js";
import { useEffect, useRef, useState } from "react";
import type { ClinicReviewQueue } from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
import { createClinicReviewClient } from "./review-api.js";
const api = createClinicReviewClient();
export function ClinicReviewPanel({
  initialClinic,
}: { initialClinic?: ClinicReviewQueue["items"][number] } = {}) {
  const [queue, setQueue] = useState<ClinicReviewQueue | null>(null);
  const [selected, setSelected] = useState<
    ClinicReviewQueue["items"][number] | null
  >(initialClinic ?? null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [],
  );
  async function operation(work: (signal: AbortSignal) => Promise<void>) {
    if (pending.current) return;
    const c = new AbortController();
    pending.current = c;
    setBusy(true);
    setMessage("");
    const timer = setTimeout(() => c.abort(), 8000);
    try {
      await work(c.signal);
    } catch {
      if (pending.current === c)
        setMessage(
          "Veprimi nuk u konfirmua. Ringarkoni listën para se të provoni sërish.",
        );
    } finally {
      clearTimeout(timer);
      if (pending.current === c) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  async function load(after?: string) {
    if (pending.current) return;
    setQueue(null);
    setSelected(null);
    setReason("");
    await operation(async (signal) => {
      const result = await api.pending(signal, after);
      if (signal.aborted) return;
      setQueue(result);
      if (!result)
        setMessage("Lista nuk është e disponueshme ose nuk keni leje.");
    });
  }
  async function decide(decision: "approved" | "refused") {
    if (!selected || pending.current) return;
    const current = selected;
    setQueue(null);
    setSelected(null);
    setReason("");
    await operation(async (signal) => {
      const result = await api.decide(
        current.id,
        {
          expected_revision: current.revision,
          decision,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        },
        signal,
      );
      if (signal.aborted) return;
      setMessage(
        result === "applied"
          ? "Vendimi u ruajt. Ringarkoni listën."
          : result === "conflict"
            ? "Kërkesa ka ndryshuar. Ringarkoni listën."
            : result === "denied"
              ? "Nuk keni leje për këtë veprim."
              : "Vendimi nuk u konfirmua. Ringarkoni listën.",
      );
    });
  }
  return (
    <section aria-label="Miratimi i klinikave">
      <h3>Klinikat në pritje</h3>
      <Button
        disabled={busy}
        onClick={() => {
          void load();
        }}
      >
        Ngarko kërkesat
      </Button>
      {message && <p role="status">{message}</p>}
      {queue && (
        <>
          <ul>
            {queue.items.map((item) => (
              <li key={item.id}>
                <Button
                  disabled={busy}
                  onClick={() => {
                    setSelected(item);
                    setReason("");
                  }}
                >
                  {item.name}
                </Button>
              </li>
            ))}
          </ul>
          {queue.items.length === 0 && <p>Nuk ka kërkesa në këtë faqe.</p>}
          {queue.next_after && (
            <Button
              disabled={busy}
              onClick={() => {
                void load(queue.next_after ?? undefined);
              }}
            >
              Faqja tjetër
            </Button>
          )}
        </>
      )}
      {selected && (
        <ClinicProfilePanel key={selected.id} clinicId={selected.id} />
      )}
      {selected && (
        <fieldset disabled={busy}>
          <legend>{selected.name}</legend>
          <label>
            Arsyeja (opsionale)
            <textarea
              value={reason}
              maxLength={2000}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <Button
            onClick={() => {
              void decide("approved");
            }}
          >
            Mirato klinikën
          </Button>
          <Button
            onClick={() => {
              void decide("refused");
            }}
          >
            Refuzo regjistrimin
          </Button>
        </fieldset>
      )}
    </section>
  );
}
