import { useEffect, useRef, useState } from "react";
import { CatalogKindSchema } from "@dental-lab/contracts";
import type { ActiveCatalogPageSchema } from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
import { createCatalogClient } from "./catalog-api.js";
const api = createCatalogClient();
const labels = {
  material: "Materialet",
  shade: "Ngjyrat",
  work_type: "Llojet e punës",
};
export function CatalogPanel() {
  const [kind, setKind] =
      useState<ReturnType<typeof CatalogKindSchema.parse>>("material"),
    [page, setPage] = useState<ReturnType<
      typeof ActiveCatalogPageSchema.parse
    > | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [],
  );
  async function load(after?: string) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setPage(null);
    setError(false);
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const result = await api.list(kind, controller.signal, after);
      if (!controller.signal.aborted) setPage(result);
    } catch {
      if (pending.current === controller) setError(true);
    } finally {
      clearTimeout(timer);
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <section aria-label="Katalogu i disponueshëm">
      <h3>Katalogu i disponueshëm</h3>
      <p>
        Këtu shfaqen vetëm referencat aktive dhe të disponueshme. Kjo listë nuk
        është miratim për dërgimin e një porosie; gjendja kontrollohet sërish
        gjatë dërgimit.
      </p>
      <label>
        Kategoria
        <select
          disabled={busy}
          value={kind}
          onChange={(event) => {
            setKind(CatalogKindSchema.parse(event.target.value));
            setPage(null);
            setError(false);
          }}
        >
          {CatalogKindSchema.options.map((value) => (
            <option key={value} value={value}>
              {labels[value]}
            </option>
          ))}
        </select>
      </label>
      <Button
        disabled={busy}
        onClick={() => {
          void load();
        }}
      >
        Ngarko katalogun
      </Button>
      {error && (
        <p role="alert">
          Katalogu nuk u ngarkua. Kontrolloni hyrjen dhe provoni përsëri.
        </p>
      )}
      {page && (
        <>
          <ul>
            {page.items.map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
          {!page.items.length && (
            <p>Nuk ka referenca të disponueshme në këtë faqe.</p>
          )}
          {page.next_after && (
            <Button
              disabled={busy}
              onClick={() => {
                void load(page.next_after ?? undefined);
              }}
            >
              Faqja tjetër
            </Button>
          )}
        </>
      )}
    </section>
  );
}
