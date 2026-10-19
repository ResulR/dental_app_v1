import { useEffect, useRef, useState } from "react";
import type { LinkedWorkPage } from "@dental-lab/contracts";
import { createLinkedWorkClient } from "./linked-work-api.js";
import { orderStatusLabels } from "./status-labels.js";
import { Button } from "../../shared/Button.js";
const api = createLinkedWorkClient();
const labels = {
  retouch: "Retushim",
  replacement: "Zëvendësim",
  supplement: "Punë shtesë",
  resubmission: "Ridërgim",
};
export function LinkedWorkPanel({
  orderId,
  onOpen,
}: {
  orderId: string;
  onOpen: (id: string) => void;
}) {
  const [page, setPage] = useState<LinkedWorkPage | null>(null),
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
  async function load(id = orderId, after?: string) {
    if (pending.current) return;
    const c = new AbortController();
    pending.current = c;
    setBusy(true);
    const timer = setTimeout(() => c.abort(), 8000);
    try {
      const next = await api.list(
        { order_id: id, ...(after ? { after } : {}) },
        c.signal,
      );
      if (!c.signal.aborted) {
        setPage(next);
        setMessage("");
      }
    } catch {
      if (pending.current === c) {
        setPage(null);
        setMessage(
          "Lidhjet nuk u verifikuan. Kontrolloni lejet dhe ringarkoni.",
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
  return (
    <div>
      <Button disabled={busy} onClick={() => void load()}>
        Punët e lidhura
      </Button>
      {page && (
        <section aria-label="Zinxhiri i punëve">
          <h4>
            Nr. {page.order.number} · {orderStatusLabels[page.order.status]}
          </h4>
          <p>
            Çdo numër përfaqëson një punë më vete. Burimi dhe puna e re ruhen
            veçmas.
          </p>
          {page.items.length === 0 ? (
            <p>Nuk ka lidhje të regjistruara.</p>
          ) : (
            <ul>
              {page.items.map((link) => (
                <li key={link.id}>
                  <p>
                    {labels[link.kind]}
                    {link.intervention_kind === "remanufacture"
                      ? " / Rifabrikim"
                      : ""}{" "}
                    · {link.created_at}
                  </p>
                  {(["source", "child"] as const).map((side) => (
                    <div key={side}>
                      <span>
                        {side === "source" ? "Burimi" : "Puna e re"}: Nr.{" "}
                        {link[side].number} ·{" "}
                        {orderStatusLabels[link[side].status]}{" "}
                      </span>
                      <Button
                        disabled={busy}
                        onClick={() => void load(link[side].id)}
                      >
                        Shiko lidhjet e Nr. {link[side].number}
                      </Button>
                      {page.can_read_details && (
                        <Button
                          disabled={busy}
                          onClick={() => onOpen(link[side].id)}
                        >
                          Hap detajet e Nr. {link[side].number}
                        </Button>
                      )}
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          )}
          {page.next_after && (
            <Button
              disabled={busy}
              onClick={() =>
                void load(page.order.id, page.next_after ?? undefined)
              }
            >
              Lidhjet e radhës
            </Button>
          )}
          <Button disabled={busy} onClick={() => void load()}>
            Kthehu te puna fillestare
          </Button>
        </section>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
