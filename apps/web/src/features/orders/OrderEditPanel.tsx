import { useEffect, useRef, useState } from "react";
import { FDI, OrderEditSchema } from "@dental-lab/contracts";
import type {
  OrderEditView,
  ActiveCatalogItemSchema,
  CatalogKindSchema,
  EffectivePermissionsSchema,
} from "@dental-lab/contracts";
import { createCatalogClient } from "../catalog/index.js";
import { createOrderEditClient } from "./edit-api.js";
import { Button } from "../../shared/Button.js";
const api = createOrderEditClient(),
  catalog = createCatalogClient();
type Kind = ReturnType<typeof CatalogKindSchema.parse>;
type Item = ReturnType<typeof ActiveCatalogItemSchema.parse>;
const labels = {
  material: "Materiali",
  shade: "Ngjyra",
  work_type: "Lloji i punës",
};
const blocked = {
  catalog_missing: "Referencë e munguar: zgjidhni vlera të vlefshme.",
  catalog_forbidden: "Referencë e ndaluar.",
  files_not_ready: "Ndryshimi i skedarëve nuk është ende i disponueshëm.",
  pending_request: "Ka kërkesë në pritje; duhet zgjidhur më parë.",
  security_block: "Bllokim sigurie aktiv.",
};
export function OrderEditPanel({
  orderId,
  clinic,
  permissions,
  onFinished,
}: {
  orderId: string;
  clinic: boolean;
  permissions: ReturnType<
    typeof EffectivePermissionsSchema.parse
  >["permissions"];
  onFinished: (text: string) => void;
}) {
  const [view, setView] = useState<OrderEditView | null>(null),
    [input, setInput] = useState<OrderEditView["input"] | null>(null),
    [reason, setReason] = useState(""),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [entries, setEntries] = useState<Record<Kind, Item[]>>({
      material: [],
      shade: [],
      work_type: [],
    }),
    [cursors, setCursors] = useState<Partial<Record<Kind, string | null>>>({});
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
    const c = new AbortController();
    pending.current = c;
    setBusy(true);
    setMessage("");
    const t = setTimeout(() => c.abort(), 8000);
    try {
      await work(c.signal);
    } catch {
      if (pending.current === c) {
        setInput(null);
        setView(null);
        onFinished(
          "Rezultati nuk u verifikua. Ringarkoni porosinë përpara një veprimi tjetër.",
        );
      }
    } finally {
      clearTimeout(t);
      if (pending.current === c) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  async function load(version_id?: string, before_version?: number) {
    await run(async (signal) => {
      const next = await api.context(
        {
          order_id: orderId,
          ...(version_id ? { version_id } : {}),
          ...(before_version ? { before_version } : {}),
        },
        signal,
      );
      if (!signal.aborted) {
        setView(next);
        setInput(next.input);
        setReason("");
        setAck(false);
      }
    });
  }
  function update(next: OrderEditView["input"]) {
    setInput(next);
    setAck(false);
  }
  async function loadCatalog(kind: Kind, next = false) {
    await run(async (signal) => {
      const page = await catalog.list(
        kind,
        signal,
        next ? (cursors[kind] ?? undefined) : undefined,
      );
      if (!signal.aborted) {
        setEntries((old) => ({
          ...old,
          [kind]: next
            ? [
                ...new Map(
                  [...old[kind], ...page.items].map((i) => [i.id, i]),
                ).values(),
              ]
            : page.items,
        }));
        setCursors((old) => ({ ...old, [kind]: page.next_after }));
      }
    });
  }
  async function submit(action: "save" | "resubmit_correction") {
    if (!view || !input) return;
    const command = {
      order_id: orderId,
      expected_version_id: view.version_id,
      expected_revision: view.revision,
      action,
      confirmed_warnings: ack,
      ...(action === "save"
        ? { input, ...(reason.trim() ? { reason: reason.trim() } : {}) }
        : {}),
    };
    const parsed = OrderEditSchema.safeParse(command);
    if (!parsed.success) {
      setMessage(
        "Kontrolloni pacientin, datën, referencat dhe dhëmbët. Referenca e fshirë duhet zëvendësuar ose hequr shprehimisht për llojin opsional.",
      );
      return;
    }
    await run(async (signal) => {
      const r = await api.decide(parsed.data, signal);
      if (signal.aborted) return;
      if (r.kind === "confirmation_required") {
        setMessage(
          "Ka referenca të padisponueshme ose pak hollësi. Shqyrtoni paralajmërimin dhe konfirmoni për të vazhduar.",
        );
        return;
      }
      setView(null);
      setInput(null);
      onFinished(
        r.kind === "updated"
          ? (action === "save"
              ? "Versioni i ri u ruajt. Statusi nuk ndryshoi."
              : "Korrigjimi u ridërgua: në pritje të vendimit të ri të laboratorit.") +
              " Ringarkoni porosinë."
          : r.kind === "blocked"
            ? blocked[r.reason]
            : "Versioni ose statusi ndryshoi. Ringarkoni porosinë.",
      );
    });
  }
  if (!clinic && !permissions.includes("orders.edit_instructions")) return null;
  const current = view?.version_id === view?.current_version_id,
    editable =
      !!view &&
      current &&
      view.file_count === 0 &&
      (clinic
        ? ["pending", "correction_requested"].includes(view.status)
        : view.status === "accepted");
  return (
    <div>
      <Button disabled={busy} onClick={() => void load()}>
        Udhëzimet dhe versionet
      </Button>
      {view && input && (
        <section>
          <h4>
            Nr. {view.number} · r{view.revision}{" "}
            {current ? "— versioni aktual" : "— version historik, vetëm lexim"}
          </h4>
          <p>
            Etiketat e ruajtura: {view.labels.material} · {view.labels.shade} ·{" "}
            {view.labels.work_type ?? "—"}
          </p>
          {view.file_count > 0 && (
            <p>
              Ka skedarë historikë. Ndryshimi bllokohet deri në integrimin e
              ruajtjes së tyre të sigurt.
            </p>
          )}
          <fieldset disabled={busy || !editable}>
            <legend>Udhëzimet zyrtare</legend>
            {(["first_name", "last_name", "internal_reference"] as const).map(
              (key) => (
                <label key={key}>
                  {key === "first_name"
                    ? "Emri"
                    : key === "last_name"
                      ? "Mbiemri"
                      : "Referenca e klinikës"}
                  <input
                    autoComplete="off"
                    value={input.patient[key] ?? ""}
                    onChange={(e) => {
                      const patient = { ...input.patient };
                      if (e.target.value.trim()) patient[key] = e.target.value;
                      else delete patient[key];
                      update({ ...input, patient });
                    }}
                  />
                </label>
              ),
            )}
            {(["material", "shade", "work_type"] as const).map((kind) => {
              const key =
                  kind === "material"
                    ? "material_id"
                    : kind === "shade"
                      ? "shade_id"
                      : "work_type_id",
                value = input[key];
              return (
                <div key={kind}>
                  <label>
                    {labels[kind]}
                    <select
                      value={value === null ? "__missing" : (value ?? "")}
                      onChange={(e) => {
                        const next = { ...input };
                        if (kind === "work_type" && !e.target.value)
                          delete next.work_type_id;
                        else next[key] = e.target.value;
                        update(next);
                      }}
                    >
                      <option value="">
                        {kind === "work_type"
                          ? "Pa lloj (opsional)"
                          : "Zgjidhni"}
                      </option>
                      {value === null && (
                        <option value="__missing">
                          Referencë historike e fshirë — zgjidhni
                        </option>
                      )}
                      {value && !entries[kind].some((i) => i.id === value) && (
                        <option value={value}>
                          {view.labels[kind] ?? "Zgjedhja historike"}
                        </option>
                      )}
                      {entries[kind].map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button onClick={() => void loadCatalog(kind)}>
                    Ngarko katalogun
                  </Button>
                  {cursors[kind] && (
                    <Button onClick={() => void loadCatalog(kind, true)}>
                      Më shumë
                    </Button>
                  )}
                </div>
              );
            })}
            <label>
              Data e dëshiruar
              <input
                type="date"
                value={input.requested_delivery_date ?? ""}
                onChange={(e) =>
                  update({
                    ...input,
                    requested_delivery_date: e.target.value || null,
                  })
                }
              />
            </label>
            <label>
              {view.kind === "retouch"
                ? "Problemi dhe dhëmbët e prekur (e detyrueshme)"
                : "Përshkrimi"}
              <textarea
                maxLength={10000}
                value={input.description ?? ""}
                onChange={(e) =>
                  update({ ...input, description: e.target.value })
                }
              />
            </label>
            {view.kind === "normal" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(8,minmax(0,1fr))",
                  gap: "0.25rem",
                }}
              >
                {FDI.map((fdi) => {
                  const t = input.teeth.find((t) => t.fdi === fdi);
                  return (
                    <Button
                      key={fdi}
                      aria-pressed={!!t}
                      onClick={() =>
                        update({
                          ...input,
                          teeth: [
                            ...input.teeth.filter((t) => t.fdi !== fdi),
                            ...(t?.selection === "pontic"
                              ? []
                              : [
                                  {
                                    fdi,
                                    selection: t
                                      ? ("pontic" as const)
                                      : ("normal" as const),
                                  },
                                ]),
                          ].sort((a, b) => a.fdi - b.fdi),
                        })
                      }
                    >
                      {fdi} ·{" "}
                      {t?.selection === "pontic"
                        ? "Antar"
                        : t
                          ? "Normal"
                          : "Bosh"}
                    </Button>
                  );
                })}
              </div>
            )}
            {!clinic && (
              <label>
                Arsyetimi i ndryshimit (i detyrueshëm)
                <textarea
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
            <label>
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              I shqyrtova paralajmërimet për disponueshmërinë dhe hollësitë.
            </label>
            <Button
              disabled={!clinic && !reason.trim()}
              onClick={() => void submit("save")}
            >
              Ruaj si version të ri
            </Button>
            {clinic && view.status === "correction_requested" && (
              <>
                <p>
                  Ruani ndryshimet, ringarkoni, pastaj ridërgoni shprehimisht.
                  Ruajtja nuk e ndryshon statusin.
                </p>
                <Button
                  disabled={
                    JSON.stringify(input) !== JSON.stringify(view.input)
                  }
                  onClick={() => void submit("resubmit_correction")}
                >
                  Ridërgo korrigjimin për shqyrtim
                </Button>
              </>
            )}
          </fieldset>
          <h4>Historiku i versioneve</h4>
          <ul>
            {view.history.map((v) => (
              <li key={v.id}>
                <Button disabled={busy} onClick={() => void load(v.id)}>
                  Versioni {v.version_number} · {v.created_at}
                </Button>
                {v.reason && <p>{v.reason}</p>}
              </li>
            ))}
          </ul>
          {view.next_before_version && (
            <Button
              disabled={busy}
              onClick={() =>
                void load(
                  view.version_id,
                  view.next_before_version ?? undefined,
                )
              }
            >
              Versione më të vjetra
            </Button>
          )}
          <Button disabled={busy} onClick={() => void load()}>
            Ringarko versionin aktual
          </Button>
        </section>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
