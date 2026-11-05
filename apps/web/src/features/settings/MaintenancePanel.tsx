import { useEffect, useRef, useState } from "react";
import type {
  MaintenanceNotice,
  MaintenanceState,
} from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
type Notice = MaintenanceNotice;
type State = MaintenanceState;
const base = "/api/v1/maintenance";
async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(base + path, {
    method,
    credentials: "same-origin",
    ...(body === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (!response.ok)
    throw new Error(response.status === 503 ? "MAINTENANCE" : "REQUEST_FAILED");
  return response.json();
}
export function MaintenancePanel({ owner }: { owner: boolean }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const draftDirty = useRef(false);
  const saving = useRef(false);
  const refreshGeneration = useRef(0);
  const edit = (next: State) => {
    draftDirty.current = true;
    setState(next);
  };
  const [history, setHistory] = useState<
    {
      revision: string;
      occurred_at: string;
      before_state: Notice;
      after_state: Notice;
    }[]
  >([]);
  const refresh = async (replaceDraft = false) => {
    const generation = ++refreshGeneration.current;
    const current = await request("/notice");
    if (generation !== refreshGeneration.current) return;
    setNotice(current);
    if (owner) {
      const latest = await request("/state");
      if (generation !== refreshGeneration.current) return;
      if (replaceDraft || !draftDirty.current) {
        setState(latest);
        draftDirty.current = false;
      }
      const page = await request("/history");
      if (generation === refreshGeneration.current) setHistory(page.items);
    }
  };
  useEffect(() => {
    let alive = true;
    const load = () => {
      void refresh()
        .then(() => {
          if (alive && !draftDirty.current) setError("");
        })
        .catch(() => {
          if (alive) {
            setNotice(null);
            setError(
              "Njoftimi nuk u verifikua; lidhja ose serveri mund të jetë i padisponueshëm.",
            );
          }
        });
    };
    load();
    const timer = window.setInterval(() => {
      if (!document.hidden && navigator.onLine && !saving.current) load();
    }, 30000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
    // The account boundary remounts this component; refresh reads current server state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);
  async function save(next: State) {
    if (busy) return;
    if (
      next.planned_at &&
      (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)$/.test(
        next.planned_at,
      ) ||
        !Number.isFinite(Date.parse(next.planned_at)))
    ) {
      setError("Shënoni një datë me zonë kohore të vlefshme.");
      return;
    }
    draftDirty.current = true;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await request("/state", "PUT", {
        expected_revision: next.revision,
        active: next.active,
        message: next.message,
        planned_at: next.planned_at
          ? new Date(next.planned_at).toISOString()
          : null,
        planned_message: next.planned_message,
      });
      if (result.kind !== "applied" && result.kind !== "unchanged") {
        setError("Gjendja ndryshoi. Ringarkojeni para një veprimi tjetër.");
      } else {
        await refresh(true);
      }
    } catch {
      setError(
        "Përgjigjja nuk u verifikua. Ringarkojeni; mos e përsëritni automatikisht.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <section aria-label="Mirëmbajtja">
      {notice?.active ? (
        <p role="status">Mirëmbajtje aktive: {notice.message}</p>
      ) : notice?.planned_at ? (
        <p role="status">
          Mirëmbajtje e planifikuar:{" "}
          <time dateTime={notice.planned_at}>
            {new Date(notice.planned_at).toLocaleString("sq-XK", {
              timeZone: "Europe/Brussels",
            })}
          </time>{" "}
          · {notice.planned_message}
        </p>
      ) : null}
      {owner && state && (
        <div>
          <h2>Mirëmbajtja</h2>
          <label>
            Mesazhi aktiv
            <input
              value={state.message}
              onChange={(e) => edit({ ...state, message: e.target.value })}
            />
          </label>
          <label>
            Data dhe ora (ISO 8601 me zonë)
            <input
              value={state.planned_at ?? ""}
              placeholder="2026-11-03T20:00:00+01:00"
              onChange={(e) =>
                edit({ ...state, planned_at: e.target.value || null })
              }
            />
          </label>
          <label>
            Mesazhi i planifikimit
            <input
              value={state.planned_message}
              onChange={(e) =>
                edit({ ...state, planned_message: e.target.value })
              }
            />
          </label>
          <Button disabled={busy} onClick={() => void save(state)}>
            Ruaj njoftimin
          </Button>
          <Button
            disabled={busy || !state.planned_at}
            onClick={() =>
              void save({ ...state, planned_at: null, planned_message: "" })
            }
          >
            Anulo njoftimin e planifikuar
          </Button>
          <Button
            disabled={busy || state.active || !state.message.trim()}
            onClick={() => void save({ ...state, active: true })}
          >
            Aktivizo mirëmbajtjen
          </Button>
          <Button
            disabled={busy || !state.active}
            onClick={() => void save({ ...state, active: false })}
          >
            Çaktivizo mirëmbajtjen
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void refresh(true).catch(() =>
                setError("Gjendja nuk u verifikua."),
              )
            }
          >
            Ringarko
          </Button>
          <h3>Historiku i fundit</h3>
          <ul>
            {history.map((item) => (
              <li key={item.revision}>
                <time dateTime={item.occurred_at}>
                  {new Date(item.occurred_at).toLocaleString("sq-XK", {
                    timeZone: "Europe/Brussels",
                  })}
                </time>{" "}
                · r{item.revision} ·{" "}
                {item.before_state.active ? "Aktive" : "Joaktive"} →{" "}
                {item.after_state.active ? "Aktive" : "Joaktive"}
                {item.before_state.planned_at !== item.after_state.planned_at
                  ? " · Orari u ndryshua"
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
