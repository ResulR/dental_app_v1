import { useEffect, useRef, useState } from "react";
import { FDI, LaboratoryLinkedWorkSchema } from "@dental-lab/contracts";
import type {
  LaboratoryLinkedWork,
  LaboratoryLinkedWorkResult,
  ActiveCatalogItemSchema,
  CatalogKindSchema,
  ToothSchema,
  OrderTrackingDetail,
} from "@dental-lab/contracts";
import { createCatalogClient } from "../catalog/index.js";
import { createLaboratoryLinkedWorkClient } from "./laboratory-linked-api.js";
import { Button } from "../../shared/Button.js";
type Kind = ReturnType<typeof CatalogKindSchema.parse>;
type Item = ReturnType<typeof ActiveCatalogItemSchema.parse>;
type Tooth = ReturnType<typeof ToothSchema.parse>;
const kinds: Kind[] = ["material", "shade", "work_type"];
const labels: Record<Kind, string> = {
  material: "Materiali",
  shade: "Ngjyra",
  work_type: "Lloji i punës (opsional)",
};
const catalog = createCatalogClient(),
  api = createLaboratoryLinkedWorkClient();
export function LaboratoryLinkedWorkForm({
  source,
  canCancel,
  onFinished,
}: {
  source: OrderTrackingDetail["order"];
  canCancel: boolean;
  onFinished: (text: string) => void;
}) {
  const [kind, setKind] = useState<"replacement" | "supplement">("supplement"),
    [reason, setReason] = useState(""),
    [exception, setException] = useState("");
  const [first, setFirst] = useState(""),
    [last, setLast] = useState(""),
    [reference, setReference] = useState(""),
    [date, setDate] = useState(""),
    [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Record<Kind, string>>({
      material: "",
      shade: "",
      work_type: "",
    }),
    [entries, setEntries] = useState<Record<Kind, Item[]>>({
      material: [],
      shade: [],
      work_type: [],
    }),
    [cursors, setCursors] = useState<Partial<Record<Kind, string | null>>>({});
  const [teeth, setTeeth] = useState<Tooth[]>([]),
    [busy, setBusy] = useState(false),
    [ack, setAck] = useState(false),
    [message, setMessage] = useState(""),
    [result, setResult] = useState<LaboratoryLinkedWorkResult | null>(null),
    [uncertain, setUncertain] = useState(false);
  const pending = useRef<AbortController | null>(null),
    intent = useRef<LaboratoryLinkedWork | null>(null);
  const frozen =
    busy ||
    uncertain ||
    result?.kind === "submitted" ||
    result?.kind === "conflict" ||
    result?.kind === "source_unavailable";
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [],
  );
  function edit() {
    setAck(false);
    setResult(null);
    setMessage("");
  }
  async function run(work: (signal: AbortSignal) => Promise<void>) {
    if (pending.current) return;
    const c = new AbortController();
    pending.current = c;
    setBusy(true);
    const timer = setTimeout(() => c.abort(), 8000);
    try {
      await work(c.signal);
    } catch {
      if (pending.current === c) {
        setUncertain(intent.current !== null);
        setMessage(
          intent.current
            ? "Rezultati është i pasigurt. Mos e mbyllni ekranin; rimerrni rezultatin me të njëjtën kërkesë."
            : "Të dhënat nuk u verifikuan. Kontrolloni lidhjen dhe lejet.",
        );
      }
    } finally {
      clearTimeout(timer);
      if (pending.current === c) {
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
    });
  }
  function cycle(fdi: Tooth["fdi"]) {
    edit();
    setTeeth((old) => {
      const prior = old.find((t) => t.fdi === fdi);
      return [
        ...old.filter((t) => t.fdi !== fdi),
        ...(prior?.selection === "pontic"
          ? []
          : [
              {
                fdi,
                selection: prior ? ("pontic" as const) : ("normal" as const),
              },
            ]),
      ].sort((a, b) => a.fdi - b.fdi);
    });
  }
  async function submit() {
    if (
      pending.current ||
      result?.kind === "submitted" ||
      result?.kind === "conflict" ||
      result?.kind === "source_unavailable"
    )
      return;
    if (!intent.current) {
      const parsed = LaboratoryLinkedWorkSchema.safeParse({
        source_order_id: source.id,
        expected_source_version_id: source.version_id,
        expected_source_revision: source.revision,
        kind,
        ...(reason.trim() ? { reason } : {}),
        ...(exception.trim() ? { exception_reason: exception } : {}),
        idempotency_key: crypto.randomUUID(),
        confirmed_warnings: ack,
        input: {
          patient: {
            ...(first.trim() ? { first_name: first.trim() } : {}),
            ...(last.trim() ? { last_name: last.trim() } : {}),
            ...(reference.trim()
              ? { internal_reference: reference.trim() }
              : {}),
          },
          requested_delivery_date: date || null,
          material_id: selected.material,
          shade_id: selected.shade,
          ...(selected.work_type ? { work_type_id: selected.work_type } : {}),
          description,
          teeth,
          file_ids: [],
        },
      });
      if (!parsed.success) {
        setMessage(
          "Plotësoni pacientin ose referencën, materialin, ngjyrën dhe arsyen e zëvendësimit.",
        );
        return;
      }
      intent.current = parsed.data;
    }
    const command = intent.current;
    await run(async (signal) => {
      const response = await api.submit(command, signal);
      if (signal.aborted) return;
      intent.current = null;
      setUncertain(false);
      setResult(response);
      if (response.kind === "submitted") {
        onFinished(
          "Puna Nr. " +
            response.number +
            " u regjistrua nga laboratori me status fillestar Pranuar. Ringarkoni listën.",
        );
        return;
      }
      const texts = {
        source_unavailable:
          "Burimi ndryshoi ose nuk lejon punë të lidhur. Ringarkoni detajet.",
        conflict:
          "Çelësi është përdorur me të dhëna të tjera. Kontrolloni historikun; dërgimi i ri bllokohet.",
        draft_conflict: "Drafti i serverit ndryshoi; nuk u krijua punë e re.",
        blocked:
          "Katalogu ose skedarët nuk kaluan kontrollet. Nuk u krijua punë dhe burimi nuk u ndryshua.",
        exception_required:
          "Referencë e padisponueshme: kërkohet konfirmim dhe arsyetim i pranimit përjashtimor.",
        confirmation_required:
          "Shqyrtoni dhe konfirmoni paralajmërimet përpara dërgimit.",
      };
      setMessage(texts[response.kind]);
    });
  }
  return (
    <section aria-label="Punë e lidhur nga laboratori">
      <h4>Krijo punë të lidhur nga porosia Nr. {source.number}</h4>
      <p>
        Krijohet punë e veçantë, menjëherë e pranuar, për klinikën{" "}
        {source.clinic_name}. Të dhënat dhe skedarët e vjetër nuk kopjohen. Mos
        e mbyllni ekranin nëse rezultati është i pasigurt.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!frozen) void submit();
        }}
      >
        <fieldset disabled={frozen}>
          <legend>Lidhja</legend>
          <label>
            Lloji
            <select
              value={kind}
              onChange={(e) => {
                edit();
                setKind(e.target.value as typeof kind);
              }}
            >
              <option value="supplement">Punë shtesë</option>
              <option
                value="replacement"
                disabled={source.status === "manufacturing" && !canCancel}
              >
                Zëvendësim
              </option>
            </select>
          </label>
          <p>
            {kind === "replacement" && source.status === "manufacturing"
              ? "Kujdes: porosia burim në fabrikim do të anulohet në të njëjtin veprim. Arsyeja është e detyrueshme."
              : "Porosia burim, statusi dhe historiku i saj ruhen pa ndryshime."}
          </p>
          <label>
            Arsyeja {kind === "replacement" ? "(e detyrueshme)" : "(opsionale)"}
            <textarea
              value={reason}
              maxLength={2000}
              required={kind === "replacement"}
              onChange={(e) => {
                edit();
                setReason(e.target.value);
              }}
            />
          </label>
        </fieldset>
        <fieldset disabled={frozen}>
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
        <fieldset disabled={frozen}>
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
            Data e dëshiruar (opsionale)
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
        <fieldset disabled={frozen}>
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
        <fieldset disabled={frozen}>
          <legend>Konfirmimi</legend>
          <p>Skedarët e rinj nuk janë ende të disponueshëm.</p>
          <label>
            Arsyetimi për referencë të padisponueshme
            <textarea
              value={exception}
              maxLength={2000}
              onChange={(e) => {
                edit();
                setException(e.target.value);
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            I shqyrtova paralajmërimet e disponueshmërisë dhe të detajeve.
          </label>
          <Button type="submit">Konfirmo krijimin e punës së pranuar</Button>
        </fieldset>
      </form>
      {uncertain && (
        <Button disabled={busy} onClick={() => void submit()}>
          Rimerr rezultatin e së njëjtës kërkesë
        </Button>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
