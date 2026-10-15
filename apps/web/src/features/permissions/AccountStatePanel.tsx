import { useEffect, useRef, useState } from "react";
import type {
  AccountStateProfileSchema,
  AccountStateListSchema,
  AccountStateHistorySchema,
  AccountStateCommandSchema,
  AccountStateFieldsSchema,
} from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
import { createAccountStateClient } from "./account-state-api.js";
const api = createAccountStateClient();
type Profile = ReturnType<typeof AccountStateProfileSchema.parse>;
type Operation = ReturnType<
  typeof AccountStateCommandSchema.parse
>["operation"];
const names = {
  suspend: "Pezullo llogarinë",
  reactivate: "Riaktivizo llogarinë",
  secure_clinic: "Siguro llogarinë",
};
function describe(state: ReturnType<typeof AccountStateFieldsSchema.parse>) {
  return [
    { active: "Aktive", invited: "E ftuar", suspended: "E pezulluar" }[
      state.lifecycle
    ],
    state.security_locked ? "E bllokuar për siguri" : "",
    state.reset_required ? "Kërkohet rivendosja e fjalëkalimit" : "",
    state.clinic_suspended ? "Klinika e pezulluar" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
export function AccountStatePanel({ type }: { type: "employee" | "clinic" }) {
  const [page, setPage] = useState<ReturnType<
      typeof AccountStateListSchema.parse
    > | null>(null),
    [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<ReturnType<
    typeof AccountStateHistorySchema.parse
  > | null>(null);
  const [confirm, setConfirm] = useState<Operation | null>(null),
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
  async function operation(work: (signal: AbortSignal) => Promise<void>) {
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
        setConfirm(null);
        setMessage(
          "Veprimi nuk u konfirmua. Ringarkoni gjendjen para se të vazhdoni.",
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
  async function load(after?: string) {
    if (pending.current) return;
    setPage(null);
    setProfile(null);
    setHistory(null);
    setConfirm(null);
    await operation(async (signal) => {
      const result = await api.list(type, signal, after);
      if (!signal.aborted) setPage(result);
    });
  }
  async function select(id: string) {
    if (pending.current) return;
    setProfile(null);
    setHistory(null);
    setConfirm(null);
    await operation(async (signal) => {
      const result = await api.profile(id, signal);
      if (!signal.aborted) setProfile(result);
    });
  }
  async function change() {
    if (!profile || !confirm || pending.current) return;
    const target = profile,
      action = confirm;
    await operation(async (signal) => {
      const result = await api.change(
        target.id,
        { expected_revision: target.revision, operation: action },
        signal,
      );
      if (signal.aborted) return;
      setProfile(null);
      setHistory(null);
      setConfirm(null);
      setPage(null);
      setMessage(
        result.kind === "applied"
          ? "Veprimi u ruajt. Sesionet e vjetra u mbyllën. " +
              (result.recoveryRequired
                ? "Kërkohet procedura e rikuperimit. "
                : "") +
              (result.invitationRequired
                ? "Kërkohet një ftesë e re; asnjë ftesë nuk u dërgua. "
                : "") +
              "Ringarkoni gjendjen."
          : result.kind === "recovery_required"
            ? "Llogaria është e bllokuar për siguri. Riaktivizimi i zakonshëm nuk lejohet."
            : result.kind === "denied"
              ? "Nuk keni leje për këtë veprim."
              : "Gjendja ka ndryshuar ose kërkesa nuk u pranua. Ringarkoni gjendjen.",
      );
    });
  }
  async function loadHistory(before?: number) {
    if (!profile || pending.current) return;
    const id = profile.id;
    setHistory(null);
    await operation(async (signal) => {
      const result = await api.history(id, signal, before);
      if (!signal.aborted) setHistory(result);
    });
  }
  return (
    <section
      aria-label={
        type === "clinic"
          ? "Gjendja e llogarive klinike"
          : "Gjendja e llogarive të punonjësve"
      }
    >
      <h3>
        {type === "clinic"
          ? "Gjendja e llogarive klinike"
          : "Gjendja e llogarive të punonjësve"}
      </h3>
      <Button
        disabled={busy}
        onClick={() => {
          void load();
        }}
      >
        Ngarko llogaritë
      </Button>
      {message && <p role="status">{message}</p>}
      {page && (
        <>
          <ul>
            {page.items.map((item) => (
              <li key={item.id}>
                <Button
                  disabled={busy}
                  onClick={() => {
                    void select(item.id);
                  }}
                >
                  {item.email}
                </Button>{" "}
                — {describe(item)}
              </li>
            ))}
          </ul>
          {!page.items.length && <p>Nuk ka llogari në këtë faqe.</p>}
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
      {profile && (
        <>
          <h4>
            {profile.email} · Versioni {profile.revision}
          </h4>
          <p>{describe(profile)}</p>
          {!confirm && (
            <>
              {profile.lifecycle !== "suspended" && (
                <Button disabled={busy} onClick={() => setConfirm("suspend")}>
                  {names.suspend}
                </Button>
              )}
              {profile.lifecycle === "suspended" && (
                <Button
                  disabled={busy || profile.security_locked}
                  onClick={() => setConfirm("reactivate")}
                >
                  {names.reactivate}
                </Button>
              )}
              {profile.can_secure && (
                <Button
                  disabled={busy}
                  onClick={() => setConfirm("secure_clinic")}
                >
                  {names.secure_clinic}
                </Button>
              )}
            </>
          )}
          {confirm && (
            <div role="alert">
              <p>
                {names[confirm]}: {profile.email}
              </p>
              <p>
                {confirm === "secure_clinic"
                  ? "Të gjitha sesionet përfundojnë. Hyrja bllokohet dhe kërkohet rivendosja e fjalëkalimit. Identiteti i kërkuesit duhet verifikuar para rikthimit të aksesit."
                  : confirm === "suspend"
                    ? "Sesioneve dhe ftesave aktive u hiqet vlefshmëria. Të dhënat dhe historiku ruhen."
                    : "Sesioneve të vjetra nuk u kthehet vlefshmëria. Masat e sigurisë dhe statusi i miratimit të klinikës ruhen."}
              </p>
              <Button
                disabled={busy}
                onClick={() => {
                  void change();
                }}
              >
                Konfirmo
              </Button>
              <Button disabled={busy} onClick={() => setConfirm(null)}>
                Anulo
              </Button>
            </div>
          )}
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
                    {names[item.operation]} · Versioni {item.revision} ·{" "}
                    {new Date(item.occurred_at).toLocaleString("sq-AL", {
                      timeZone: "Europe/Pristina",
                    })}
                    <p>Para: {describe(item.previous)}</p>
                    <p>Pas: {describe(item.next)}</p>
                  </li>
                ))}
              </ol>
              {!history.items.length && (
                <p>Nuk ka ndryshime të regjistruara.</p>
              )}
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
        </>
      )}
    </section>
  );
}
