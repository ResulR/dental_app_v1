import { useEffect, useRef, useState } from "react";
import { FDI, OrderPreflightInputSchema } from "@dental-lab/contracts";
import type {
  ActiveCatalogItemSchema,
  CatalogKindSchema,
  OrderPreflightResultSchema,
  ToothSchema,
} from "@dental-lab/contracts";
import { createCatalogClient } from "../catalog/index.js";
import { createOrderPreflightClient } from "./preflight-api.js";
import { Button } from "../../shared/Button.js";
type Kind = ReturnType<typeof CatalogKindSchema.parse>;
type Item = ReturnType<typeof ActiveCatalogItemSchema.parse>;
type Tooth = ReturnType<typeof ToothSchema.parse>;
const catalog = createCatalogClient(),
  api = createOrderPreflightClient();
const kinds: Kind[] = ["material", "shade", "work_type"];
const labels: Record<Kind, string> = {
  material: "Materiali",
  shade: "Ngjyra",
  work_type: "Lloji i punës (opsional)",
};
const issues = {
  catalog_forbidden: "Referencë e ndaluar: nuk lejohet dërgimi ose pranimi.",
  catalog_missing: "Referenca nuk u gjet ose kategoria nuk përputhet.",
  files_not_ready: "Skedarët nuk janë verifikuar.",
  catalog_unavailable:
    "Referencë e padisponueshme: pranimi përjashtimor kërkon arsyetim dhe konfirmim nga laboratori.",
  low_detail: "Nuk janë zgjedhur dhëmbë dhe përshkrimi është bosh.",
};
export function ClinicOrderForm() {
  const [first, setFirst] = useState(""),
    [last, setLast] = useState(""),
    [reference, setReference] = useState(""),
    [date, setDate] = useState(""),
    [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Record<Kind, string>>({
    material: "",
    shade: "",
    work_type: "",
  });
  const [entries, setEntries] = useState<Record<Kind, Item[]>>({
    material: [],
    shade: [],
    work_type: [],
  });
  const [cursors, setCursors] = useState<Partial<Record<Kind, string | null>>>(
    {},
  );
  const [teeth, setTeeth] = useState<Tooth[]>([]),
    [result, setResult] = useState<ReturnType<
      typeof OrderPreflightResultSchema.parse
    > | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [],
  );
  function edit() {
    setResult(null);
    setMessage("");
  }
  async function run(work: (signal: AbortSignal) => Promise<void>) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setMessage("");
    setResult(null);
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      await work(controller.signal);
    } catch {
      if (pending.current === controller)
        setMessage(
          "Kontrolli nuk u përfundua. Të dhënat mbeten vetëm në këtë ekran; nuk është dërguar asnjë porosi.",
        );
    } finally {
      clearTimeout(timer);
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  async function load(kind: Kind, next = false) {
    await run(async (signal) => {
      const page = await catalog.list(
        kind,
        signal,
        next ? (cursors[kind] ?? undefined) : undefined,
      );
      if (signal.aborted) return;
      setEntries((previous) => ({
        ...previous,
        [kind]: next
          ? [
              ...new Map(
                [...previous[kind], ...page.items].map((item) => [
                  item.id,
                  item,
                ]),
              ).values(),
            ]
          : page.items,
      }));
      setCursors((previous) => ({ ...previous, [kind]: page.next_after }));
    });
  }
  function input() {
    return {
      patient: {
        ...(first.trim() ? { first_name: first.trim() } : {}),
        ...(last.trim() ? { last_name: last.trim() } : {}),
        ...(reference.trim() ? { internal_reference: reference.trim() } : {}),
      },
      requested_delivery_date: date,
      material_id: selected.material,
      shade_id: selected.shade,
      ...(selected.work_type ? { work_type_id: selected.work_type } : {}),
      description,
      teeth,
      file_ids: [],
    };
  }
  async function check() {
    if (!OrderPreflightInputSchema.safeParse(input()).success) {
      setResult(null);
      setMessage(
        "Plotësoni emrin dhe mbiemrin, ose referencën e klinikës; kontrolloni datën, materialin dhe ngjyrën. Nëse shkruani emrin, kërkohet edhe mbiemri.",
      );
      return;
    }
    await run(async (signal) => {
      const checked = await api.check(input(), signal);
      if (!signal.aborted) setResult(checked);
    });
  }
  function cycle(fdi: Tooth["fdi"]) {
    edit();
    setTeeth((previous) => {
      const old = previous.find((t) => t.fdi === fdi);
      return [
        ...previous.filter((t) => t.fdi !== fdi),
        ...(old?.selection === "pontic"
          ? []
          : [
              {
                fdi,
                selection: old ? ("pontic" as const) : ("normal" as const),
              },
            ]),
      ].sort((a, b) => a.fdi - b.fdi);
    });
  }
  return (
    <section aria-label="Përgatitja e porosisë">
      <h3>Përgatitja e porosisë</h3>
      <p>
        Ky formular kontrollon të dhënat dhe gjendjen aktuale të katalogut. Nuk
        krijon porosi dhe nuk ruan draft. Mbyllja e ekranit i humb të dhënat.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void check();
        }}
      >
        <fieldset disabled={busy}>
          <legend>Identifikimi i pacientit</legend>
          <label>
            Emri
            <input
              value={first}
              onChange={(e) => {
                edit();
                setFirst(e.target.value);
              }}
              autoComplete="off"
            />
          </label>
          <label>
            Mbiemri
            <input
              value={last}
              onChange={(e) => {
                edit();
                setLast(e.target.value);
              }}
              autoComplete="off"
            />
          </label>
          <label>
            Referenca e klinikës
            <input
              value={reference}
              onChange={(e) => {
                edit();
                setReference(e.target.value);
              }}
              autoComplete="off"
            />
          </label>
          <p>
            Emër dhe mbiemër, ose referencë e brendshme. Mund të plotësohen të
            dyja.
          </p>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Puna e kërkuar</legend>
          {kinds.map((kind) => (
            <div key={kind}>
              <label>
                {labels[kind]}
                <select
                  value={selected[kind]}
                  onChange={(event) => {
                    edit();
                    setSelected({ ...selected, [kind]: event.target.value });
                  }}
                >
                  <option value="">Zgjidhni</option>
                  {selected[kind] &&
                    !entries[kind].some(
                      (item) => item.id === selected[kind],
                    ) && (
                      <option value={selected[kind]}>
                        Zgjedhja e mëparshme — kërkon verifikim
                      </option>
                    )}
                  {entries[kind].map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                onClick={() => {
                  void load(kind);
                }}
              >
                Ngarko {labels[kind].toLowerCase()}
              </Button>
              {cursors[kind] && (
                <Button
                  onClick={() => {
                    void load(kind, true);
                  }}
                >
                  Më shumë
                </Button>
              )}
            </div>
          ))}
          <label>
            Data e dëshiruar
            <input
              type="date"
              value={date}
              onChange={(event) => {
                edit();
                setDate(event.target.value);
              }}
            />
          </label>
          <p>Data e planifikuar caktohet veçmas nga laboratori.</p>
          <label>
            Përshkrimi (opsional)
            <textarea
              maxLength={10000}
              value={description}
              onChange={(event) => {
                edit();
                setDescription(event.target.value);
              }}
            />
          </label>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Dhëmbët (opsional)</legend>
          <p>Shtypni për të kaluar: bosh → normal → pontik (antar) → bosh.</p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(8,minmax(0,1fr))",
              gap: "0.25rem",
            }}
          >
            {FDI.map((fdi) => {
              const value = teeth.find((t) => t.fdi === fdi)?.selection;
              return (
                <Button
                  key={fdi}
                  aria-pressed={!!value}
                  onClick={() => cycle(fdi)}
                >
                  {fdi} ·{" "}
                  {value === "pontic"
                    ? "Antar"
                    : value === "normal"
                      ? "Normal"
                      : "Bosh"}
                </Button>
              );
            })}
          </div>
          <p>
            {teeth.length
              ? teeth
                  .map(
                    (t) =>
                      t.fdi +
                      " " +
                      (t.selection === "pontic" ? "antar" : "normal"),
                  )
                  .join(", ")
              : "Asnjë dhëmb i zgjedhur."}
          </p>
        </fieldset>
        {!teeth.length && !description.trim() && (
          <p>Nuk ka dhëmbë ose përshkrim. Ky është paralajmërim, jo ndalim.</p>
        )}
        <Button type="submit" disabled={busy}>
          Kontrollo të dhënat
        </Button>
      </form>
      {message && <p role="status">{message}</p>}
      {result && (
        <div role="status">
          <p>
            {result.status === "blocked"
              ? "U gjetën pengesa."
              : "Kontrolli përfundoi."}{" "}
            Asnjë porosi nuk është dërguar.
          </p>
          <ul>
            {[...result.reasons, ...result.warnings].map((code) => (
              <li key={code}>{issues[code]}</li>
            ))}
          </ul>
          <ul>
            {result.references.map((item) => (
              <li key={item.id}>
                {labels[item.kind]}:{" "}
                {item.label ?? "Referencë historike pa hyrje aktuale"} ·{" "}
                {item.state === "available"
                  ? "E disponueshme"
                  : item.state === "unavailable"
                    ? "E padisponueshme"
                    : "E ndaluar"}
              </li>
            ))}
          </ul>
          <p>
            Ky kontroll nuk rezervon referencat; gjendja duhet kontrolluar
            sërish gjatë depozitimit zyrtar.
          </p>
        </div>
      )}
    </section>
  );
}
