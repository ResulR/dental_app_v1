import { useEffect, useRef, useState } from "react";
import type { ClinicDirectory } from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
import { ClinicProfilePanel } from "./ClinicProfilePanel.js";
import { createClinicReviewClient } from "./review-api.js";
const api = createClinicReviewClient();
const states = {
  pending: "Në pritje",
  approved: "E miratuar",
  refused: "E refuzuar",
};
export function ClinicDirectoryPanel() {
  const [page, setPage] = useState<ClinicDirectory | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
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
  async function load(after?: string) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setPage(null);
    setSelected(null);
    setMessage("");
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const result = await api.directory(controller.signal, after);
      if (!controller.signal.aborted && pending.current === controller) {
        setPage(result);
        if (!result) setMessage("Lista nuk u konfirmua ose nuk keni leje.");
      }
    } catch {
      if (pending.current === controller)
        setMessage("Lista nuk u ngarkua. Provoni përsëri.");
    } finally {
      clearTimeout(timer);
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <section aria-label="Lista e klinikave">
      <h3>Klinikat</h3>
      <Button
        disabled={busy}
        onClick={() => {
          void load();
        }}
      >
        Ngarko klinikat
      </Button>
      {message && <p role="status">{message}</p>}
      {busy && <p role="status">Po ngarkohen klinikat…</p>}
      {page && (
        <>
          <ul>
            {page.items.map((item) => (
              <li key={item.id}>
                <Button disabled={busy} onClick={() => setSelected(item.id)}>
                  {item.name}
                </Button>
                <span>
                  {" "}
                  — {states[item.review_state]}
                  {item.suspended ? " · E pezulluar" : ""}
                </span>
              </li>
            ))}
          </ul>
          {page.items.length === 0 && <p>Nuk ka klinika në këtë faqe.</p>}
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
      {selected && <ClinicProfilePanel key={selected} clinicId={selected} />}
    </section>
  );
}
