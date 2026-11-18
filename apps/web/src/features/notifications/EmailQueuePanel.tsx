import { useEffect, useRef, useState } from "react";
import type { EmailQueuePageSchema } from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
import { createEmailQueueClient } from "./email-queue-api.js";
type Page = ReturnType<typeof EmailQueuePageSchema.parse>;
const read = createEmailQueueClient();
const labels = {
  pending: "Në pritje",
  provider_accepted: "Pranuar nga ofruesi",
  failed: "Dështuar",
  cancelled: "Anuluar",
};
const attempts = {
  provider_accepted: "Pranuar nga ofruesi",
  temporary_error: "Gabim i përkohshëm",
  permanent_error: "Gabim i përhershëm",
  ambiguous: "Përgjigje e pasigurt — kërkohet rakordim",
};
export function EmailQueuePanel() {
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState<Page | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  const pending = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      epoch.current++;
      pending.current?.abort();
    },
    [],
  );
  async function load(
    before?: NonNullable<Page["next_before"]>,
    state = filter,
  ) {
    const turn = ++epoch.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setMessage("");
    try {
      const result = await read(
        {
          ...(state ? { state } : {}),
          ...(before ? { before } : {}),
        },
        controller.signal,
      );
      if (turn !== epoch.current || controller.signal.aborted) return;
      setPage((current) =>
        before && current?.next_before?.id === before.id
          ? { ...result, items: [...current.items, ...result.items] }
          : result,
      );
    } catch {
      if (turn === epoch.current && !controller.signal.aborted) {
        setPage(null);
        setMessage(
          "Gjendja e e-mail-eve nuk u verifikua. Kontrolloni lejet dhe lidhjen.",
        );
      }
    } finally {
      if (turn === epoch.current) {
        setBusy(false);
        pending.current = null;
      }
    }
  }
  return (
    <section aria-label="Gjendja e e-mail-eve">
      <h3>Gjendja e e-mail-eve</h3>
      <p>
        Pranimi nga ofruesi nuk dëshmon mbërritjen ose leximin. Asnjë dërgim nuk
        niset nga kjo faqe.
      </p>
      <label>
        Gjendja
        <select
          value={filter}
          onChange={(event) => {
            const next = event.target.value;
            setFilter(next);
            setPage(null);
            void load(undefined, next);
          }}
        >
          <option value="">Të gjitha</option>
          {Object.entries(labels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <Button type="button" disabled={busy} onClick={() => void load()}>
        Rifresko
      </Button>
      {page?.items.length === 0 && <p>Nuk u gjet asnjë e-mail.</p>}
      <ol>
        {page?.items.map((item) => (
          <li key={item.id}>
            <p>
              {item.created_at} · {item.event_type} · {labels[item.state]}
            </p>
            <p>
              Tentativa: {item.attempt_count} · E fundit:{" "}
              {item.last_result ? attempts[item.last_result] : "—"} · Kodi:{" "}
              {item.last_error_code ?? item.cancellation_code ?? "—"}
            </p>
            {item.last_attempt_at && (
              <p>Koha e tentativës: {item.last_attempt_at}</p>
            )}
            {item.state === "pending" && (
              <p>Kontrolli tjetër: {item.next_attempt_at}</p>
            )}
          </li>
        ))}
      </ol>
      {page?.next_before && (
        <Button
          type="button"
          disabled={busy}
          onClick={() => void load(page.next_before ?? undefined)}
        >
          Më shumë
        </Button>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
