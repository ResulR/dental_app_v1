import { useEffect, useRef, useState } from "react";
import type { LaboratoryClinicListSchema } from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
import { LaboratoryLinkedWorkForm } from "./LaboratoryLinkedWorkForm.js";
import { createLaboratoryClinicClient } from "./laboratory-clinic-api.js";
const api = createLaboratoryClinicClient();
export function LaboratoryClinicOrderPanel() {
  const [page, setPage] = useState<ReturnType<
    typeof LaboratoryClinicListSchema.parse
  > | null>(null);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
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
    if (pending.current || sending) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setSelected(null);
    setPage(null);
    setMessage("");
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const next = await api.clinics(after, controller.signal);
      if (!controller.signal.aborted) setPage(next);
    } catch {
      if (pending.current === controller)
        setMessage("Klinikat nuk u verifikuan. Kontrolloni lidhjen dhe lejet.");
    } finally {
      clearTimeout(timer);
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <section aria-label="Porosi e re nga laboratori">
      <h3>Porosi për klinikën</h3>
      <p>
        Përzgjidhni një klinikë aktive. Porosia regjistrohet e pranuar me
        autorin laboratorik; klinika njoftohet brenda portalit.
      </p>
      <Button disabled={busy || sending} onClick={() => void load()}>
        Ngarko klinikat e autorizuara
      </Button>
      {page && (
        <>
          <ul>
            {page.items.map((clinic) => (
              <li key={clinic.id}>
                <Button
                  disabled={busy || sending}
                  onClick={() => setSelected(clinic)}
                >
                  {clinic.name}
                </Button>
              </li>
            ))}
          </ul>
          {page.next_after && (
            <Button
              disabled={busy || sending}
              onClick={() => void load(page.next_after ?? undefined)}
            >
              Faqja tjetër
            </Button>
          )}
        </>
      )}
      {selected && (
        <LaboratoryLinkedWorkForm
          key={selected.id}
          clinic={selected}
          onSendingChange={setSending}
          onFinished={(text) => {
            setSelected(null);
            setPage(null);
            setMessage(text);
          }}
        />
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
