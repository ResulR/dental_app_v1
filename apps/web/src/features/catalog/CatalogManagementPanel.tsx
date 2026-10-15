import { useEffect, useRef, useState } from "react";
import { CatalogKindSchema } from "@dental-lab/contracts";
import type {
  CatalogManagedProfileSchema,
  CatalogManagedPageSchema,
  CatalogHistorySchema,
  CatalogImpactsSchema,
  CatalogManagedFieldsSchema,
} from "@dental-lab/contracts";
import { Button } from "../../shared/Button.js";
import { createCatalogManagementClient } from "./management-api.js";
const api = createCatalogManagementClient();
const kinds = { material: "Material", shade: "Ngjyrë", work_type: "Lloj pune" };
const states = {
  available: "E disponueshme",
  unavailable: "E padisponueshme",
  forbidden: "E ndaluar",
};
type Profile = ReturnType<typeof CatalogManagedProfileSchema.parse>;
function describe(value: ReturnType<typeof CatalogManagedFieldsSchema.parse>) {
  return [
    value.label ?? "E hequr nga katalogu",
    value.is_active === false ? "Joaktive" : "",
    states[value.use_state],
    value.forbidden_reason ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
}
export function CatalogManagementPanel({ owner = false }: { owner?: boolean }) {
  const [impacts, setImpacts] = useState<ReturnType<
    typeof CatalogImpactsSchema.parse
  > | null>(null);
  const [reason, setReason] = useState("");
  const [page, setPage] = useState<ReturnType<
      typeof CatalogManagedPageSchema.parse
    > | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [history, setHistory] = useState<ReturnType<
      typeof CatalogHistorySchema.parse
    > | null>(null);
  const [kind, setKind] =
      useState<ReturnType<typeof CatalogKindSchema.parse>>("material"),
    [label, setLabel] = useState(""),
    [active, setActive] = useState(true),
    [state, setState] = useState<"available" | "unavailable">("available"),
    [confirm, setConfirm] = useState<
      "create" | "update" | "remove" | "restrict" | null
    >(null),
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
  function clear() {
    setProfile(null);
    setImpacts(null);
    setReason("");
    setHistory(null);
    setConfirm(null);
    setLabel("");
  }
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
        clear();
        setPage(null);
        setMessage(
          "Rezultati nuk u konfirmua. Ringarkoni katalogun dhe kontrolloni historikun para se të përsërisni veprimin.",
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
    clear();
    setPage(null);
    await run(async (signal) => {
      const result = await api.list(signal, after);
      if (!signal.aborted) setPage(result);
    });
  }
  async function select(id: string) {
    if (pending.current) return;
    clear();
    await run(async (signal) => {
      const result = await api.profile(id, signal);
      if (!signal.aborted) {
        setProfile(result);
        setLabel(result.label ?? "");
        setActive(result.is_active ?? false);
        setState(
          result.use_state === "unavailable" ? "unavailable" : "available",
        );
      }
    });
  }
  async function historyPage(before?: number) {
    if (!profile || pending.current) return;
    const id = profile.id;
    setHistory(null);
    await run(async (signal) => {
      const result = await api.history(id, signal, before);
      if (!signal.aborted) setHistory(result);
    });
  }
  async function impactsPage(after?: string) {
    if (!profile || pending.current) return;
    const id = profile.id;
    setImpacts(null);
    await run(async (signal) => {
      const result = await api.impacts(id, signal, after);
      if (!signal.aborted) setImpacts(result);
    });
  }
  async function save() {
    if (!confirm || pending.current) return;
    const operation = confirm,
      target = profile;
    await run(async (signal) => {
      const result =
        operation === "create"
          ? await api.create({ kind, label }, signal)
          : target
            ? await api.change(
                target.id,
                operation === "restrict"
                  ? { operation, expected_revision: target.revision, reason }
                  : operation === "remove"
                    ? { operation, expected_revision: target.revision }
                    : {
                        operation,
                        expected_revision: target.revision,
                        label,
                        is_active: active,
                        use_state: state,
                      },
                signal,
              )
            : null;
      if (signal.aborted) return;
      clear();
      setPage(null);
      setMessage(
        result?.kind === "applied"
          ? "Ndryshimi u ruajt. Ringarkoni katalogun."
          : result?.kind === "restricted"
            ? "Referenca është e ndaluar. Ndryshimi i zakonshëm nuk lejohet."
            : "Kërkesa nuk u pranua. Kontrolloni lejet dhe ringarkoni versionin aktual.",
      );
    });
  }
  const editable =
    profile?.label !== null && profile?.use_state !== "forbidden";
  return (
    <section aria-label="Administrimi i katalogut">
      <h3>Administrimi i katalogut</h3>
      <p>
        Ndryshimet nuk rishkruajnë vlerat historike të porosive. Ndalimet e
        sigurisë nuk hiqen nga ky formular.
      </p>
      <Button
        disabled={busy}
        onClick={() => {
          void load();
        }}
      >
        Ngarko referencat
      </Button>
      <Button
        disabled={busy}
        onClick={() => {
          clear();
          setActive(true);
          setState("available");
        }}
      >
        Referencë e re
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
                  {kinds[item.kind]}: {item.label ?? "E hequr"}
                </Button>{" "}
                — {describe(item)}
              </li>
            ))}
          </ul>
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
      {(!profile || editable) && (
        <fieldset disabled={busy || confirm !== null}>
          <legend>{profile ? "Ndrysho referencën" : "Shto referencë"}</legend>
          {!profile && (
            <label>
              Kategoria
              <select
                value={kind}
                onChange={(event) =>
                  setKind(CatalogKindSchema.parse(event.target.value))
                }
              >
                {CatalogKindSchema.options.map((value) => (
                  <option key={value} value={value}>
                    {kinds[value]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Emërtimi
            <input
              value={label}
              maxLength={500}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          {profile && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(event) => setActive(event.target.checked)}
                />
                Aktive në katalog
              </label>
              <label>
                Disponueshmëria
                <select
                  value={state}
                  onChange={(event) =>
                    setState(
                      event.target.value === "unavailable"
                        ? "unavailable"
                        : "available",
                    )
                  }
                >
                  <option value="available">E disponueshme</option>
                  <option value="unavailable">E padisponueshme</option>
                </select>
              </label>
            </>
          )}
          <Button
            disabled={!label.trim()}
            onClick={() => setConfirm(profile ? "update" : "create")}
          >
            Rishiko ndryshimin
          </Button>
          {profile && (
            <Button onClick={() => setConfirm("remove")}>
              Hiqe nga katalogu aktual
            </Button>
          )}
        </fieldset>
      )}
      {profile && (
        <>
          <p>
            {describe(profile)} · Versioni {profile.revision}
          </p>
          {profile.use_state === "forbidden" && (
            <p role="alert">
              Referencë e ndaluar: {profile.forbidden_reason}. Nuk mund të
              riaktivizohet ose të hiqet me këtë veprim.
            </p>
          )}
          <Button
            disabled={busy}
            onClick={() => {
              void historyPage();
            }}
          >
            Shiko historikun
          </Button>
        </>
      )}
      {profile && profile.use_state !== "forbidden" && (
        <fieldset disabled={busy || confirm !== null}>
          <legend>Ndalim sigurie</legend>
          <label>
            Arsyeja e detyrueshme
            <textarea
              value={reason}
              maxLength={2000}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <Button
            disabled={!reason.trim()}
            onClick={() => setConfirm("restrict")}
          >
            Rishiko ndalimin
          </Button>
        </fieldset>
      )}
      {profile && owner && (
        <Button
          disabled={busy}
          onClick={() => {
            void impactsPage();
          }}
        >
          Shiko punët e prekura
        </Button>
      )}
      {impacts && (
        <section aria-label="Punët e prekura">
          <p>
            Përfshihen versionet historike dhe punët e dorëzuara, për shqyrtim
            sigurie.
          </p>
          <ul>
            {impacts.items.map((item) => (
              <li key={item.id}>
                Nr. {item.number} ·{" "}
                {
                  {
                    pending: "Në pritje",
                    correction_requested: "Kërkohet korrigjim",
                    rejected: "Refuzuar",
                    accepted: "Pranuar",
                    manufacturing: "Në prodhim",
                    completed: "Përfunduar",
                    delivered: "Dorëzuar — për shqyrtim",
                    cancelled: "Anuluar",
                  }[item.status]
                }
              </li>
            ))}
          </ul>
          {impacts.next_after && (
            <Button
              disabled={busy}
              onClick={() => {
                void impactsPage(impacts.next_after ?? undefined);
              }}
            >
              Faqja tjetër e punëve
            </Button>
          )}
        </section>
      )}
      {confirm && (
        <div role="alert">
          <p>
            {confirm === "restrict"
              ? "Ndalimi bllokon punët e padorëzuara dhe regjistron alarmin për pronarin. Nuk anulohet asnjë porosi. Arsyeja: " +
                reason
              : confirm === "remove"
                ? "Hiqet vetëm hyrja aktuale; referenca dhe historiku i porosive ruhen."
                : `${label} · ${profile ? states[state] : "E re dhe e disponueshme"} · ${active ? "Aktive" : "Joaktive"}`}
          </p>
          <Button
            disabled={busy}
            onClick={() => {
              void save();
            }}
          >
            Konfirmo
          </Button>
          <Button disabled={busy} onClick={() => setConfirm(null)}>
            Anulo
          </Button>
        </div>
      )}
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
                  {item.previous ? describe(item.previous) : "Referencë e re"}
                </p>
                <p>Pas: {describe(item.next)}</p>
              </li>
            ))}
          </ol>
          {history.next_before && (
            <Button
              disabled={busy}
              onClick={() => {
                void historyPage(history.next_before ?? undefined);
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
