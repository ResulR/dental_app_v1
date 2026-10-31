import { useEffect, useRef, useState } from "react";
import { RetouchSubmissionSchema } from "@dental-lab/contracts";
import type {
  RetouchSubmission,
  OrderEditView,
  ActiveCatalogItemSchema,
} from "@dental-lab/contracts";
import { createOrderEditClient } from "./edit-api.js";
import { createRetouchClient } from "./retouch-api.js";
import { createCatalogClient } from "../catalog/index.js";
import { Button } from "../../shared/Button.js";
const sourceApi = createOrderEditClient(),
  api = createRetouchClient(),
  catalog = createCatalogClient();
type Item = ReturnType<typeof ActiveCatalogItemSchema.parse>;
type Kind = "material" | "shade";
export function OrderRetouchForm({
  sourceId,
  onFinished,
}: {
  sourceId: string;
  onFinished: (receipt: {
    id: string;
    number: string;
    sourceNumber: string;
  }) => void;
}) {
  const [source, setSource] = useState<OrderEditView | null>(null),
    [material, setMaterial] = useState(""),
    [shade, setShade] = useState(""),
    [description, setDescription] = useState(""),
    [intervention, setIntervention] = useState<"retouch" | "remanufacture">(
      "retouch",
    ),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [uncertain, setUncertain] = useState(false);
  const [entries, setEntries] = useState<Record<Kind, Item[]>>({
      material: [],
      shade: [],
    }),
    [cursors, setCursors] = useState<Partial<Record<Kind, string | null>>>({});
  const pending = useRef<AbortController | null>(null),
    intent = useRef<RetouchSubmission | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [],
  );
  async function run(fn: (signal: AbortSignal) => Promise<void>) {
    if (pending.current) return;
    const c = new AbortController();
    pending.current = c;
    setBusy(true);
    const timer = setTimeout(() => c.abort(), 8000);
    try {
      await fn(c.signal);
    } catch {
      if (pending.current === c) {
        setUncertain(intent.current !== null);
        setMessage(
          intent.current
            ? "Rezultati është i pasigurt. Riprovoni të njëjtën kërkesë për të marrë rezultatin; mos krijoni një kërkesë tjetër."
            : "Nuk u verifikuan të dhënat. Ringarkoni përpara se të vazhdoni.",
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
  async function load() {
    if (intent.current) return;
    await run(async (signal) => {
      const v = await sourceApi.context({ order_id: sourceId }, signal);
      if (signal.aborted) return;
      if (v.status !== "delivered") {
        setSource(null);
        setMessage("Retushimi kërkohet vetëm nga puna e dorëzuar realisht.");
        return;
      }
      setSource(v);
      setMaterial(v.input.material_id ?? "");
      setShade(v.input.shade_id ?? "");
      setDescription("");
      setAck(false);
      setMessage("");
    });
  }
  async function loadCatalog(kind: Kind, next = false) {
    await run(async (signal) => {
      const r = await catalog.list(
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
                [...old[kind], ...r.items].map((i) => [i.id, i]),
              ).values(),
            ]
          : r.items,
      }));
      setCursors((old) => ({ ...old, [kind]: r.next_after }));
    });
  }
  async function submit() {
    if (pending.current || !source) return;
    if (!intent.current) {
      const parsed = RetouchSubmissionSchema.safeParse({
        idempotency_key: crypto.randomUUID(),
        confirmed_warnings: ack,
        input: {
          source_order_id: sourceId,
          expected_source_version_id: source.current_version_id,
          expected_source_revision: source.revision,
          intervention_kind: intervention,
          material_id: material,
          shade_id: shade,
          description,
          file_ids: [],
        },
      });
      if (!parsed.success) {
        setMessage(
          "Zgjidhni materialin, ngjyrën dhe përshkruani problemin me dhëmbët e prekur.",
        );
        return;
      }
      intent.current = parsed.data;
    }
    const command = intent.current;
    await run(async (signal) => {
      const r = await api.submit(command, signal);
      if (signal.aborted) return;
      intent.current = null;
      setUncertain(false);
      if (r.kind === "submitted") {
        setSource(null);
        onFinished({
          id: r.order_id,
          number: r.number,
          sourceNumber: source.number,
        });
        return;
      }
      const labels = {
        source_unavailable:
          "Porosia burim ndryshoi ose nuk është e dorëzuar. Ringarkoni.",
        active_retouch: "Ekziston një retushim aktiv për këtë punë.",
        conflict:
          "Çelësi i kërkesës ka të dhëna të tjera. Kontrolloni historikun përpara një kërkese të re.",
        draft_conflict: "Drafti i serverit ndryshoi; nuk u krijua retushim.",
        blocked:
          "Katalogu ose skedarët nuk kaluan kontrollet. Asnjë retushim nuk u regjistrua.",
        confirmation_required:
          "Referencë e padisponueshme. Shqyrtoni paralajmërimin dhe konfirmoni.",
      };
      setMessage(labels[r.kind]);
      if (
        r.kind === "source_unavailable" ||
        r.kind === "active_retouch" ||
        r.kind === "conflict"
      )
        setSource(null);
    });
  }
  return (
    <div>
      <Button disabled={busy || uncertain} onClick={() => void load()}>
        Kërko retushim / rifabrikim
      </Button>
      {source && (
        <>
          <fieldset disabled={busy || uncertain}>
            <legend>Puna e dorëzuar Nr. {source.number}</legend>
            <p>
              Krijohet punë e re me numër dhe bisedë të veçantë. Puna e
              mëparshme ruhet.
            </p>
            <label>
              Ndërhyrja
              <select
                value={intervention}
                onChange={(e) =>
                  setIntervention(e.target.value as typeof intervention)
                }
              >
                <option value="retouch">Retushim</option>
                <option value="remanufacture">Rifabrikim</option>
              </select>
            </label>
            {(["material", "shade"] as const).map((kind) => (
              <div key={kind}>
                <label>
                  {kind === "material" ? "Materiali" : "Ngjyra"}
                  <select
                    value={kind === "material" ? material : shade}
                    onChange={(e) => {
                      (kind === "material" ? setMaterial : setShade)(
                        e.target.value,
                      );
                      setAck(false);
                    }}
                  >
                    <option value="">Zgjidhni</option>
                    {(kind === "material" ? material : shade) &&
                      !entries[kind].some(
                        (i) =>
                          i.id === (kind === "material" ? material : shade),
                      ) && (
                        <option value={kind === "material" ? material : shade}>
                          {(kind === "material" ? material : shade) ===
                          source.input[
                            (kind + "_id") as "material_id" | "shade_id"
                          ]
                            ? source.labels[kind]
                            : "Zgjedhja aktuale"}{" "}
                          — kontrollohet nga serveri
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
            ))}
            <label>
              Problemi dhe dhëmbët e prekur (e detyrueshme)
              <textarea
                required
                maxLength={10000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <p>
              Skedarët shtesë nuk janë ende të disponueshëm. Skedarët e vjetër
              nuk kopjohen automatikisht.
            </p>
            <label>
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              I shqyrtova paralajmërimet e disponueshmërisë.
            </label>
            <Button onClick={() => void submit()}>
              Dërgo kërkesën e retushimit
            </Button>
          </fieldset>
          {uncertain && (
            <Button disabled={busy} onClick={() => void submit()}>
              Rimerr rezultatin e së njëjtës kërkesë
            </Button>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
