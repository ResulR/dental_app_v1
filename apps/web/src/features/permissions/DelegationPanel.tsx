import type {
  DelegationHistorySchema,
  DelegationListSchema,
} from "@dental-lab/contracts";
import { useEffect, useRef, useState } from "react";
import { PermissionCodeSchema } from "@dental-lab/contracts";
import type { DelegationKind, DelegationProfile } from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
import { createDelegationClient } from "./delegation-api.js";
import { permissionLabels } from "./labels.js";
const api = createDelegationClient();
type Code = ReturnType<typeof PermissionCodeSchema.parse>;
export function DelegationPanel({ owner = false }: { owner?: boolean }) {
  const [kind, setKind] = useState<DelegationKind>("employee");
  const [page, setPage] = useState<ReturnType<
    typeof DelegationListSchema.parse
  > | null>(null);
  const [profile, setProfile] = useState<DelegationProfile | null>(null);
  const [codes, setCodes] = useState<Code[]>([]);
  const [dropped, setDropped] = useState<Code[] | null>(null);
  const [history, setHistory] = useState<ReturnType<
    typeof DelegationHistorySchema.parse
  > | null>(null);
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
        setDropped(null);
        setMessage(
          "Veprimi nuk u konfirmua. Ringarkoni gjendjen para se të provoni përsëri.",
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
    setDropped(null);
    await operation(async (signal) => {
      const result = await api.list(kind, signal, after);
      if (!signal.aborted) setPage(result);
    });
  }
  async function select(id: string) {
    if (pending.current) return;
    setProfile(null);
    setHistory(null);
    setDropped(null);
    await operation(async (signal) => {
      const result = await api.profile(kind, id, signal);
      if (!signal.aborted) {
        setProfile(result);
        setCodes(result.permission_codes);
      }
    });
  }
  async function save(confirm = false) {
    if (!profile || pending.current) return;
    const current = profile;
    await operation(async (signal) => {
      const result = await api.change(
        kind,
        current.id,
        {
          expected_revision: current.revision,
          permission_codes: codes,
          ...(confirm && dropped ? { confirmed_dropped_codes: dropped } : {}),
        },
        signal,
      );
      if (signal.aborted) return;
      if (result.kind === "confirmation_required") {
        setDropped(result.dropped_codes ?? []);
        return;
      }
      setProfile(null);
      setHistory(null);
      setDropped(null);
      setMessage(
        result.kind === "applied"
          ? "Ndryshimet u ruajtën. Sesionet e llogarisë së ndryshuar u rivlerësuan. Ringarkoni gjendjen."
          : result.kind === "conflict"
            ? "Gjendja ka ndryshuar. Ringarkoni para se të vazhdoni."
            : result.kind === "denied"
              ? "Nuk keni leje për këtë ndryshim."
              : "Lejet nuk u pranuan. Kontrolloni parakushtet dhe ringarkoni gjendjen.",
      );
    });
  }
  async function loadHistory(before?: number) {
    if (!profile || pending.current) return;
    const id = profile.id;
    setHistory(null);
    await operation(async (signal) => {
      const result = await api.history(kind, id, signal, before);
      if (!signal.aborted) setHistory(result);
    });
  }
  return (
    <section aria-label="Lejet e punonjësve">
      <h3>Lejet e punonjësve</h3>
      {owner && (
        <label>
          Veprimi
          <select
            disabled={busy}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as DelegationKind);
              setPage(null);
              setProfile(null);
              setHistory(null);
              setDropped(null);
              setMessage("");
            }}
          >
            <option value="employee">Lejet e punonjësve</option>
            <option value="envelope">
              Kufijtë e delegimit për administratorët
            </option>
          </select>
        </label>
      )}
      <p>
        {kind === "employee"
          ? "Ndryshoni vetëm lejet e autorizuara. Lejet e tjera ruhen."
          : "Përcaktoni cilat leje mund t'i ndryshojë administratori te punonjësit. Kjo nuk i jep atij leje përdorimi."}
      </p>
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
                —{" "}
                {
                  {
                    active: "Aktive",
                    invited: "E ftuar",
                    suspended: "E pezulluar",
                  }[item.lifecycle]
                }
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
          <fieldset disabled={busy || dropped !== null}>
            <legend>
              {kind === "employee" ? "Lejet aktuale" : "Lejet e delegueshme"}
            </legend>
            {PermissionCodeSchema.options
              .filter(
                (code) =>
                  profile.editable_codes.includes(code) ||
                  profile.permission_codes.includes(code),
              )
              .map((code) => (
                <label key={code} style={{ display: "block" }}>
                  <input
                    type="checkbox"
                    checked={codes.includes(code)}
                    disabled={!profile.editable_codes.includes(code)}
                    onChange={(e) =>
                      setCodes((previous) =>
                        e.target.checked
                          ? [...previous, code]
                          : previous.filter((c) => c !== code),
                      )
                    }
                  />
                  {permissionLabels[code]}
                </label>
              ))}
          </fieldset>
          <p>
            Ndryshimi i lejeve ose i kufijve përfundon sesionet aktive të
            llogarisë së ndryshuar.
          </p>
          {dropped === null ? (
            <Button
              disabled={busy}
              onClick={() => {
                void save();
              }}
            >
              Ruaj ndryshimet
            </Button>
          ) : (
            <div role="alert">
              <p>
                Heqja e parakushteve heq edhe këto leje. Konfirmoni për të
                vazhduar:
              </p>
              <ul>
                {dropped.map((code) => (
                  <li key={code}>{permissionLabels[code]}</li>
                ))}
              </ul>
              <Button
                disabled={busy}
                onClick={() => {
                  void save(true);
                }}
              >
                Konfirmo heqjen
              </Button>
              <Button disabled={busy} onClick={() => setDropped(null)}>
                Kthehu te lejet
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
                    Versioni {item.revision} ·{" "}
                    {new Date(item.occurred_at).toLocaleString("sq-AL", {
                      timeZone: "Europe/Pristina",
                    })}
                    <p>
                      Para:{" "}
                      {item.previous_codes
                        .map((c) => permissionLabels[c])
                        .join(", ") || "Pa leje"}
                    </p>
                    <p>
                      Pas:{" "}
                      {item.next_codes
                        .map((c) => permissionLabels[c])
                        .join(", ") || "Pa leje"}
                    </p>
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
