import { useEffect, useRef, useState } from "react";
import type { OrderFilesPage } from "@dental-lab/contracts";
import { createOrderTrackingClient } from "./tracking-api.js";
import { Button } from "../../shared/Button.js";
const api = createOrderTrackingClient();
// Parent keys this panel by order and version; old requests cannot populate a new work.
export function OrderFilesPanel({
  orderId,
  versionId,
}: {
  orderId: string;
  versionId: string;
}) {
  const [page, setPage] = useState<OrderFilesPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    setError("");
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const result = await api.files(
        {
          order_id: orderId,
          version_id: versionId,
          ...(after ? { after } : {}),
        },
        controller.signal,
      );
      if (pending.current === controller) setPage(result);
    } catch {
      if (pending.current === controller) {
        setPage(null);
        setError(
          "Skedarët nuk u verifikuan. Rifreskoni punimin dhe kontrolloni lidhjen ose lejet.",
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
  return (
    <section aria-label="Skedarët e punimit" aria-busy={busy}>
      <h4>Skedarët e versionit aktual</h4>
      <Button disabled={busy} onClick={() => void load()}>
        {busy ? "Duke ngarkuar listën…" : "Shfaq skedarët"}
      </Button>
      {error && <p role="alert">{error}</p>}
      {page && (
        <>
          {page.items.length === 0 ? (
            <p>Nuk ka skedarë të verifikuar për t'u shfaqur.</p>
          ) : (
            <ul>
              {page.items.map((file) => (
                <li key={file.id} style={{ overflowWrap: "anywhere" }}>
                  {file.filename} — {file.format.toUpperCase()} —{" "}
                  {file.size_bytes} bajte
                </li>
              ))}
            </ul>
          )}
          {page.next_after && (
            <Button
              disabled={busy}
              onClick={() => void load(page.next_after ?? undefined)}
            >
              Skedarët e tjerë
            </Button>
          )}
          <p>
            Shkarkimi dhe ngarkimi i skedarëve nuk janë ende të disponueshëm.
          </p>
        </>
      )}
    </section>
  );
}
