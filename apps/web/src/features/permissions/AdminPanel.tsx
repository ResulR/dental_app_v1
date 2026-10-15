import { useEffect, useRef, useState } from "react";
import type {
  AdminProfileSchema,
  AdminListSchema,
  AdminHistorySchema,
  AdminCommandSchema,
  AdminFieldsSchema,
} from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
import { createAdminClient } from "./admin-api.js";
import { permissionLabels } from "./labels.js";
import { PermissionCodeSchema } from "@dental-lab/contracts";
const api = createAdminClient();
type Profile = ReturnType<typeof AdminProfileSchema.parse>;
type Operation = ReturnType<typeof AdminCommandSchema.parse>["operation"];
const names = {
  suspend: "Pezullo llogarinë",
  reactivate: "Riaktivizo llogarinë",
  permissions: "Ndrysho lejet",
};
function describe(state: ReturnType<typeof AdminFieldsSchema.parse>) {
  return [
    { active: "Aktive", invited: "E ftuar", suspended: "E pezulluar" }[
      state.lifecycle
    ],
    state.security_locked ? "E bllokuar për siguri" : "",
    state.reset_required ? "Kërkohet rivendosja e fjalëkalimit" : "",
    state.permission_codes.map((code) => permissionLabels[code]).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
}
export function AdminPanel() {
  const [codes, setCodes] = useState<
    Array<ReturnType<typeof PermissionCodeSchema.parse>>
  >([]);
  const [page, setPage] = useState<ReturnType<
      typeof AdminListSchema.parse
    > | null>(null),
    [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<ReturnType<
    typeof AdminHistorySchema.parse
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
      const result = await api.list(signal, after);
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
      if (!signal.aborted) {
        setProfile(result);
        setCodes(result.permission_codes);
      }
    });
  }
  async function change() {
    if (!profile || !confirm || pending.current) return;
    const target = profile,
      action = confirm;
    await operation(async (signal) => {
      const result = await api.change(
        target.id,
        {
          expected_revision: target.revision,
          operation: action,
          ...(action === "permissions" ? { permission_codes: codes } : {}),
        },
        signal,
      );
      if (signal.aborted) return;
      setProfile(null);
      setHistory(null);
      setConfirm(null);
      setPage(null);
      setMessage(
        result.kind === "applied"
          ? "Kërkesa u pranua. " +
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
    <section aria-label="Administrimi i administratorëve">
      <h3>Administrimi i administratorëve</h3>
      <p>
        Vetëm pronari menaxhon këto llogari. Ftesat e reja nuk janë ende të
        aktivizuara.
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
              <fieldset disabled={busy}>
                <legend>Lejet e administratorit</legend>
                {PermissionCodeSchema.options.map((code) => (
                  <label key={code} style={{ display: "block" }}>
                    <input
                      type="checkbox"
                      checked={codes.includes(code)}
                      onChange={(event) =>
                        setCodes((previous) =>
                          event.target.checked
                            ? [...previous, code]
                            : previous.filter((value) => value !== code),
                        )
                      }
                    />
                    {permissionLabels[code]}
                  </label>
                ))}
              </fieldset>
              <p>
                Lejet varen nga njëra-tjetra. Kërkesa me varësi të paplotësuara
                refuzohet; nuk shtohen leje automatikisht.
              </p>
              <Button disabled={busy} onClick={() => setConfirm("permissions")}>
                Rishiko ndryshimin e lejeve
              </Button>
            </>
          )}
          {confirm && (
            <div role="alert">
              <p>
                {names[confirm]}: {profile.email}
              </p>
              <p>
                {confirm === "permissions"
                  ? "Lejet zëvendësohen me përzgjedhjen e mëposhtme. Sesionet ekzistuese mbyllen nëse lejet ndryshojnë."
                  : confirm === "suspend"
                    ? "Sesioneve dhe ftesave aktive u hiqet vlefshmëria. Të dhënat dhe historiku ruhen."
                    : "Sesioneve të vjetra nuk u kthehet vlefshmëria. Masat e sigurisë ruhen; një llogari pa fjalëkalim mbetet e ftuar."}
              </p>
              {confirm === "permissions" && (
                <ul>
                  {codes.map((code) => (
                    <li key={code}>{permissionLabels[code]}</li>
                  ))}
                </ul>
              )}
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
