import { ClinicProfileForm } from "./ClinicProfileForm.js";
import { useEffect, useRef, useState } from "react";
import type {
  ClinicProfile,
  ClinicContactUpdate,
  ClinicContactHistory,
} from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
import { createClinicProfileClient } from "./profile-api.js";
const api = createClinicProfileClient();
export function ClinicProfilePanel({ clinicId }: { clinicId?: string } = {}) {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    return () => {
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
    };
  }, []);
  const [profile, setProfile] = useState<ClinicProfile | null>(null);
  const [history, setHistory] = useState<ClinicContactHistory | null>(null);
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
    setHistory(null);
    setMessage("");
    setBusy(true);
    try {
      const result = await api.own(controller.signal, clinicId);
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
  async function save(input: ClinicContactUpdate) {
    if (!profile || pending.current) throw new Error("PROFILE_BUSY");
    const controller = new AbortController();
    pending.current = controller;
    const timer = setTimeout(() => controller.abort(), 8000);
    setBusy(true);
    setHistory(null);
    try {
      return await api.save(profile.id, input, controller.signal);
    } finally {
      clearTimeout(timer);
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  async function loadHistory(before?: number) {
    if (!profile || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const timer = setTimeout(() => controller.abort(), 8000);
    setBusy(true);
    setHistory(null);
    try {
      const result = await api.history(profile.id, controller.signal, before);
      if (pending.current !== controller) return;
      setHistory(result);
      if (!result) setMessage("Historiku nuk është i disponueshëm.");
    } catch {
      if (pending.current === controller)
        setMessage("Historiku nuk u ngarkua.");
    } finally {
      clearTimeout(timer);
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  const labels = {
    name: "Klinika",
    dentist_first_name: "Emri i dentistit",
    dentist_last_name: "Mbiemri i dentistit",
    phone: "Telefoni",
    address: "Adresa",
  };
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
        <>
          <ClinicProfileForm
            key={profile.id + ":" + profile.revision}
            profile={profile}
            canEdit={!busy}
            online={online}
            save={save}
          />
          <Button
            disabled={busy}
            onClick={() => {
              void loadHistory();
            }}
          >
            Shiko historikun
          </Button>
          {history && (
            <>
              <ol>
                {history.items.map((item) => (
                  <li key={item.id}>
                    <p>
                      Versioni {item.revision} ·{" "}
                      {new Date(item.occurred_at).toLocaleString("sq-AL", {
                        timeZone: "Europe/Pristina",
                      })}
                    </p>
                    <dl>
                      {(Object.keys(labels) as Array<keyof typeof labels>)
                        .filter((key) => item.previous[key] !== item.next[key])
                        .map((key) => (
                          <div key={key}>
                            <dt>{labels[key]}</dt>
                            <dd>
                              {item.previous[key]} → {item.next[key]}
                            </dd>
                          </div>
                        ))}
                    </dl>
                  </li>
                ))}
              </ol>
              {history.items.length === 0 && (
                <p>Nuk ka ndryshime të regjistruara.</p>
              )}
              {history.next_before && (
                <Button
                  disabled={busy}
                  onClick={() => {
                    void loadHistory(history.next_before ?? undefined);
                  }}
                >
                  Më të vjetra
                </Button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
