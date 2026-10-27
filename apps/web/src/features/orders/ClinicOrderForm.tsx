import { createOrderSubmissionClient } from "./submission-api.js";
import {
  OrderSubmissionSchema,
  type OrderSubmissionResultSchema,
} from "@dental-lab/contracts";
import { useEffect, useRef, useState } from "react";
import { FDI, OrderPreflightInputSchema } from "@dental-lab/contracts";
import type {
  ActiveCatalogItemSchema,
  CatalogKindSchema,
  OrderPreflightResultSchema,
  OrderSimilarityResultSchema,
  ToothSchema,
} from "@dental-lab/contracts";
import { createCatalogClient } from "../catalog/index.js";
import { createOrderPreflightClient } from "./preflight-api.js";
import { createOrderSimilarityClient } from "./similarity-api.js";
import { Button } from "../../shared/Button.js";
type Kind = ReturnType<typeof CatalogKindSchema.parse>;
type Item = ReturnType<typeof ActiveCatalogItemSchema.parse>;
type Tooth = ReturnType<typeof ToothSchema.parse>;
const catalog = createCatalogClient(),
  api = createOrderPreflightClient(),
  similarityApi = createOrderSimilarityClient(),
  submissionApi = createOrderSubmissionClient();
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
export function ClinicOrderForm({
  onInspectOrder,
}: {
  onInspectOrder?: (number: string) => void;
}) {
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
  const [similar, setSimilar] = useState<ReturnType<
    typeof OrderSimilarityResultSchema.parse
  > | null>(null);
  const [similarityUnavailable, setSimilarityUnavailable] = useState(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [submission, setSubmission] = useState<ReturnType<
    typeof OrderSubmissionResultSchema.parse
  > | null>(null);
  const [intent, setIntent] = useState<ReturnType<
    typeof OrderSubmissionSchema.parse
  > | null>(null);
  const [ack, setAck] = useState(false);
  const frozen = busy || intent !== null || submission?.kind === "submitted";
  const pending = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [],
  );
  function edit() {
    setSubmission(null);
    setAck(false);
    setResult(null);
    setSimilar(null);
    setSimilarityUnavailable(false);
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
  async function submit() {
    if (
      pending.current ||
      submission?.kind === "submitted" ||
      submission?.kind === "conflict"
    )
      return;
    const request =
      intent ??
      OrderSubmissionSchema.parse({
        idempotency_key: crypto.randomUUID(),
        input: input(),
        confirmed_warnings: ack,
      });
    setIntent(request);
    await run(async (signal) => {
      try {
        const response = await submissionApi.submit(request, signal);
        if (signal.aborted) return;
        setSubmission(response);
        if (response.kind !== "conflict") setIntent(null);
      } catch {
        if (!signal.aborted || pending.current)
          setMessage(
            "Rezultati i dërgimit është i pasigurt. Mos e mbyllni ekranin. Përdorni të njëjtën kërkesë për ta verifikuar; mos krijoni një porosi tjetër.",
          );
      }
    });
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
      const requested = input();
      const checked = await api.check(requested, signal);
      if (signal.aborted) return;
      setResult(checked);
      setSimilar(null);
      setSimilarityUnavailable(false);
      try {
        const found = await similarityApi.check(requested, signal);
        if (!signal.aborted) setSimilar(found);
      } catch {
        if (pending.current) setSimilarityUnavailable(true);
      }
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
        Kontrolloni të dhënat, pastaj dërgoni porosinë me konfirmim të qartë.
        Drafti nuk ruhet në pajisje. Mos e mbyllni ekranin nëse rezultati i
        dërgimit është i pasigurt.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!frozen) void check();
        }}
      >
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
        <Button type="submit" disabled={frozen}>
          Kontrollo të dhënat
        </Button>
      </form>
      {intent && submission?.kind !== "conflict" && (
        <Button disabled={busy} onClick={() => void submit()}>
          Verifiko përsëri të njëjtin dërgim
        </Button>
      )}
      {submission?.kind === "submitted" && (
        <SubmittedOrderReceipt
          number={submission.number}
          receivedAt={submission.received_at}
          onInspectOrder={onInspectOrder}
        />
      )}
      {submission?.kind === "blocked" && (
        <ul role="alert">
          {submission.reasons.map((code) => (
            <li key={code}>{issues[code]}</li>
          ))}
        </ul>
      )}
      {submission?.kind === "confirmation_required" && (
        <p role="alert">
          Gjendja ndryshoi. Kontrolloni përsëri dhe konfirmoni paralajmërimet
          para dërgimit.
        </p>
      )}
      {submission?.kind === "conflict" && (
        <p role="alert">
          Kjo kërkesë është përdorur me të dhëna të tjera. Nevojitet verifikim;
          dërgimi i ri është bllokuar.
        </p>
      )}
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
          {similarityUnavailable && (
            <p role="status">
              Kontrolli i ngjashmërisë nuk u përfundua. Mund të vazhdoni;
              kontrolloni listën e porosive nëse keni dyshim.
            </p>
          )}
          {similar && similar.matches.length > 0 && (
            <div role="alert">
              <p>
                Mund të ekzistojë një porosi e ngjashme në klinikën tuaj. Kjo
                nuk e ndalon dërgimin; emri i njëjtë nuk provon se është i
                njëjti pacient.
              </p>
              <ul>
                {similar.matches.map((item) => (
                  <li key={item.order_id}>
                    Nr. {item.number} ·{" "}
                    {item.signal === "same_reference_and_work"
                      ? "referencë, datë, material dhe ngjyrë të njëjta"
                      : "emër, datë, material dhe ngjyrë të njëjta"}
                    .{" "}
                    <a
                      href="#order-tracking"
                      onClick={() => onInspectOrder?.(item.number)}
                    >
                      Shikoni porosinë në listë
                    </a>
                  </li>
                ))}
              </ul>
              <p>Mund të vazhdoni me një porosi të re nëse është e saktë.</p>
            </div>
          )}
          {result.status === "checked" && !frozen && (
            <>
              {result.warnings.length > 0 && (
                <label>
                  <input
                    type="checkbox"
                    checked={ack}
                    onChange={(e) => setAck(e.target.checked)}
                  />
                  I lexova paralajmërimet dhe dëshiroj të vazhdoj.
                </label>
              )}
              <Button
                disabled={result.warnings.length > 0 && !ack}
                onClick={() => void submit()}
              >
                Konfirmo dhe dërgo porosinë
              </Button>
            </>
          )}
          <p>
            Ky kontroll nuk rezervon referencat; gjendja duhet kontrolluar
            sërish gjatë depozitimit zyrtar.
          </p>
        </div>
      )}
    </section>
  );
}

export function SubmittedOrderReceipt({
  number,
  receivedAt,
  onInspectOrder,
}: {
  number: string;
  receivedAt: string;
  onInspectOrder?: ((number: string) => void) | undefined;
}) {
  return (
    <p role="status">
      Porosia nr. {number} u regjistrua. Marrë më {receivedAt}. Statusi
      fillestar: Në pritje.{" "}
      <a href="#order-tracking" onClick={() => onInspectOrder?.(number)}>
        Shikoni porosinë në listë
      </a>
    </p>
  );
}
