import { useEffect, useRef, useState } from "react";
import { LaboratoryFieldsSchema } from "@dental-lab/contracts";
import type {
  LaboratoryProfileSchema,
  LaboratoryHistorySchema,
} from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
import { createLaboratorySettingsClient } from "./settings-api.js";
const api = createLaboratorySettingsClient();
type Fields = ReturnType<typeof LaboratoryFieldsSchema.parse>;
const empty: Fields = {
  name: null,
  address: null,
  phone: null,
  email: null,
  opening_hours: null,
  map_url: null,
};
const labels: Record<keyof Fields, string> = {
  name: "Emri i laboratorit",
  address: "Adresa",
  phone: "Telefoni",
  email: "E-mail",
  opening_hours: "Orari",
  map_url: "Lidhja e vendndodhjes",
};
const keys = Object.keys(labels) as (keyof Fields)[];
function Values({ fields }: { fields: Fields | null }) {
  if (!fields) return <p>Të dhënat e laboratorit nuk janë plotësuar ende.</p>;
  return (
    <dl>
      {keys.map((key) => (
        <div key={key}>
          <dt>{labels[key]}</dt>
          <dd style={{ whiteSpace: "pre-wrap" }}>
            {fields[key] ?? "Nuk është plotësuar"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function LaboratorySettingsPanel({
  manage = false,
}: {
  manage?: boolean;
}) {
  const [profile, setProfile] = useState<ReturnType<
    typeof LaboratoryProfileSchema.parse
  > | null>(null);
  const [draft, setDraft] = useState<Fields>(empty),
    [history, setHistory] = useState<ReturnType<
      typeof LaboratoryHistorySchema.parse
    > | null>(null);
  const [confirm, setConfirm] = useState(false),
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
        setProfile(null);
        setHistory(null);
        setDraft(empty);
        setConfirm(false);
        setMessage(
          "Rezultati nuk u konfirmua. Ringarkoni të dhënat dhe kontrolloni historikun para se të përsërisni ndryshimin.",
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
  async function load() {
    if (pending.current) return;
    setProfile(null);
    setConfirm(false);
    setHistory(null);
    await run(async (signal) => {
      const result = await api.read(signal);
      if (!signal.aborted) {
        setProfile(result);
        setDraft(result.fields ?? empty);
      }
    });
  }
  async function save() {
    if (!profile || !confirm) return;
    const command = { expected_revision: profile.revision, fields: draft };
    await run(async (signal) => {
      const result = await api.update(command, signal);
      if (signal.aborted) return;
      setConfirm(false);
      setProfile(null);
      setDraft(empty);
      setHistory(null);
      setMessage(
        result.kind === "applied"
          ? "Ndryshimi u ruajt. Ringarkoni të dhënat."
          : "Ndryshimi nuk u pranua. Ringarkoni versionin aktual dhe kontrolloni lejet.",
      );
    });
  }
  async function loadHistory(before?: number) {
    if (pending.current) return;
    setHistory(null);
    await run(async (signal) => {
      const result = await api.history(signal, before);
      if (!signal.aborted) setHistory(result);
    });
  }
  return (
    <section
      aria-label={
        manage ? "Cilësimet e laboratorit" : "Informacioni i laboratorit"
      }
    >
      <h3>
        {manage ? "Cilësimet e laboratorit" : "Informacioni i laboratorit"}
      </h3>
      <Button
        disabled={busy}
        onClick={() => {
          void load();
        }}
      >
        Ngarko të dhënat
      </Button>
      {message && <p role="status">{message}</p>}
      {profile && !manage && (
        <>
          <Values fields={profile.fields} />
          {profile.fields?.map_url && (
            <a
              href={profile.fields.map_url}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
            >
              Hap vendndodhjen në faqe të jashtme
            </a>
          )}
        </>
      )}
      {manage && profile && (
        <fieldset disabled={busy || confirm}>
          <legend>Ndrysho të dhënat publike</legend>
          {keys.map((key) => (
            <label key={key}>
              {labels[key]}
              <textarea
                value={draft[key] ?? ""}
                maxLength={
                  {
                    name: 200,
                    address: 1000,
                    phone: 100,
                    email: 254,
                    opening_hours: 2000,
                    map_url: 2048,
                  }[key]
                }
                onChange={(event) =>
                  setDraft({ ...draft, [key]: event.target.value || null })
                }
              />
            </label>
          ))}
          <p>
            Fushat bosh hiqen nga informacioni publik. Lidhja e vendndodhjes
            duhet të jetë HTTPS.
          </p>
          <Button
            disabled={!LaboratoryFieldsSchema.safeParse(draft).success}
            onClick={() => setConfirm(true)}
          >
            Rishiko ndryshimet
          </Button>
        </fieldset>
      )}
      {confirm && (
        <div role="alert">
          <p>Konfirmoni të dhënat që do të shohin klinikat.</p>
          <Values fields={draft} />
          <Button
            disabled={busy}
            onClick={() => {
              void save();
            }}
          >
            Ruaj ndryshimet
          </Button>
          <Button disabled={busy} onClick={() => setConfirm(false)}>
            Anulo
          </Button>
        </div>
      )}
      {manage && (
        <Button
          disabled={busy}
          onClick={() => {
            void loadHistory();
          }}
        >
          Shiko historikun
        </Button>
      )}
      {history && (
        <>
          <ol>
            {history.items.map((item) => (
              <li key={item.id}>
                Versioni {item.revision} ·{" "}
                {new Date(item.occurred_at).toLocaleString("sq-AL", {
                  timeZone: "Europe/Pristina",
                })}{" "}
                · Llogaria {item.actor_id}
                <p>Para ndryshimit</p>
                <Values fields={item.previous} />
                <p>Pas ndryshimit</p>
                <Values fields={item.next} />
              </li>
            ))}
          </ol>
          {history.next_before && (
            <Button
              disabled={busy}
              onClick={() => {
                void loadHistory(history.next_before ?? undefined);
              }}
            >
              Ndryshime më të vjetra
            </Button>
          )}
        </>
      )}
    </section>
  );
}
