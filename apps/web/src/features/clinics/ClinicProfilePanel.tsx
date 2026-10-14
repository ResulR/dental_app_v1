import { useEffect, useRef, useState } from "react";
import type { ClinicProfile } from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
import { createClinicProfileClient } from "./profile-api.js";
const api = createClinicProfileClient();
export function ClinicProfilePanel() {
  const [profile, setProfile] = useState<ClinicProfile | null>(null);
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
  async function load() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const timer = setTimeout(() => controller.abort(), 8000);
    setProfile(null);
    setMessage("");
    setBusy(true);
    try {
      const result = await api.own(controller.signal);
      if (pending.current !== controller) return;
      setProfile(result);
      if (!result)
        setMessage(
          "Profili nuk është i disponueshëm. Verifikoni lidhjen dhe lejet.",
        );
    } catch {
      if (pending.current === controller)
        setMessage("Profili nuk u ngarkua. Provoni përsëri.");
    } finally {
      clearTimeout(timer);
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <section aria-label="Profili i klinikës">
      <h3>Të dhënat e klinikës</h3>
      <Button
        disabled={busy}
        onClick={() => {
          void load();
        }}
      >
        Ngarko profilin
      </Button>
      {message && <p role="status">{message}</p>}
      {profile && (
        <dl>
          <dt>Klinika</dt>
          <dd>{profile.name}</dd>
          <dt>Dentisti</dt>
          <dd>
            {profile.dentist_first_name} {profile.dentist_last_name}
          </dd>
          <dt>Telefoni</dt>
          <dd>{profile.phone}</dd>
          <dt>Adresa</dt>
          <dd>{profile.address}</dd>
        </dl>
      )}
    </section>
  );
}
