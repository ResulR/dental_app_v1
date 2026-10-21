import { useEffect, useRef, useState } from "react";
import type {
  OrderLifecycleContextSchema,
  DeliveryBatchCommand,
} from "@dental-lab/contracts";
import { createOrderLifecycleClient } from "./lifecycle-api.js";
import { createDeliveryBatchClient } from "./delivery-batch-api.js";
import { Button } from "../../shared/Button.js";
const contextClient = createOrderLifecycleClient(),
  batchClient = createDeliveryBatchClient();
const explanations = {
  catalog_missing: "Referencat e katalogut kërkojnë verifikim.",
  catalog_forbidden: "Një referencë e katalogut është e ndaluar.",
  security_block: "Një porosi ka bllokim sigurie.",
  files_not_ready: "Skedarët e një porosie nuk janë verifikuar.",
  pending_request: "Një porosi ka kërkesë në pritje.",
};
type Context = ReturnType<typeof OrderLifecycleContextSchema.parse>;
export function ReadyDeliveryBatch({
  rows,
  onFinished,
}: {
  rows: { id: string; number: string; status: string }[];
  onFinished: (message: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [prepared, setPrepared] = useState<Context[] | null>(null),
    [mode, setMode] = useState<DeliveryBatchCommand["items"][number]["mode"]>(
      "laboratory_delivery",
    ),
    [confirmed, setConfirmed] = useState(false),
    [receiptId, setReceiptId] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const pending = useRef<AbortController | null>(null);
  const uncertain = useRef<string | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
    },
    [],
  );
  function change(id: string, checked: boolean) {
    setSelected((ids) =>
      checked ? [...ids, id] : ids.filter((value) => value !== id),
    );
    setPrepared(null);
    setConfirmed(false);
    setReceiptId(null);
    uncertain.current = null;
  }
  async function run(work: (signal: AbortSignal) => Promise<void>) {
    if (pending.current) return;
    const c = new AbortController();
    pending.current = c;
    setBusy(true);
    setMessage("");
    const timer = setTimeout(() => c.abort(), 8000);
    try {
      await work(c.signal);
    } catch {
      if (pending.current === c)
        setMessage(
          uncertain.current
            ? "Rezultati nuk u verifikua. Kontrolloni faturën me të njëjtin identifikues; mos krijoni dërgesë të re."
            : "Gjendja nuk u verifikua. Ringarkoni listën përpara një veprimi tjetër.",
        );
    } finally {
      clearTimeout(timer);
      if (pending.current === c) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  async function prepare() {
    if (selected.length < 2 || selected.length > 10) return;
    await run(async (signal) => {
      const contexts: Context[] = [];
      for (const id of selected) {
        const context = await contextClient.context(id, signal);
        if (context.status !== "completed") {
          setPrepared(null);
          setMessage("Një porosi nuk është më gati. Ringarkoni listën.");
          return;
        }
        contexts.push(context);
      }
      if (!signal.aborted) {
        setPrepared(contexts);
        setConfirmed(false);
        setReceiptId(null);
      }
    });
  }
  function describe(kind: string, reason?: keyof typeof explanations) {
    if (kind === "conflict")
      return "Një porosi ndryshoi. Asnjë dorëzim në këtë lot; ringarkoni listën.";
    if (kind === "blocked")
      return (
        (reason ? explanations[reason] : "Një porosi u bllokua.") +
        " Asnjë dorëzim në këtë lot."
      );
    if (kind === "receipt_mismatch")
      return "Ky identifikues i faturës i përket një përmbajtjeje tjetër.";
    return "Nuk u gjet faturë e konfirmuar. Nëse përgjigjja ishte e pasigurt, kontrollojeni sërish.";
  }
  async function deliver() {
    if (!prepared || !confirmed || receiptId || uncertain.current || pending.current) return;
    const id = crypto.randomUUID();
    setReceiptId(id);
    uncertain.current = id;
    const command = {
      receipt_id: id,
      confirmed: true,
      items: prepared.map((row) => ({
        order_id: row.order_id,
        expected_version_id: row.version_id,
        expected_revision: row.revision,
        mode,
      })),
    };
    // Keep the receipt ID on uncertain responses; never allocate a second key automatically.
    await run(async (signal) => {
      const response = await batchClient.deliver(command, signal);
      if (response.kind === "delivered") {
        setPrepared(null);
        onFinished(
          "U dorëzuan " +
            response.items.length +
            " porosi. Fatura: " +
            response.receipt_id,
        );
      } else {
        setReceiptId(null);
        uncertain.current = null;
        setPrepared(null);
        setMessage(
          describe(
            response.kind,
            response.kind === "blocked" ? response.reason : undefined,
          ),
        );
      }
    });
  }
  async function lookup() {
    if (!receiptId) return;
    await run(async (signal) => {
      const response = await batchClient.receipt(receiptId, signal);
      if (response.kind === "delivered") {
        setPrepared(null);
        onFinished(
          "Dorëzimi u verifikua: " +
            response.items.length +
            " porosi. Fatura: " +
            response.receipt_id,
        );
      } else
        setMessage(
          describe(
            response.kind,
            response.kind === "blocked" ? response.reason : undefined,
          ),
        );
    });
  }
  return (
    <section aria-label="Dorëzim në grup">
      <h4>Dorëzim në grup</h4>
      <p>
        Zgjidhni 2 deri në 10 porosi të dukshme. Të gjitha duhet të jenë gati;
        asnjë dorëzim i pjesshëm.
      </p>
      <p>{selected.length} porosi të zgjedhura nga kjo faqe.</p>
      {rows
        .filter((row) => row.status === "completed")
        .map((row) => (
          <label key={row.id}>
            <input
              type="checkbox"
              disabled={
                busy ||
                !!receiptId ||
                (!selected.includes(row.id) && selected.length >= 10)
              }
              checked={selected.includes(row.id)}
              onChange={(e) => change(row.id, e.target.checked)}
            />
            Nr. {row.number}
          </label>
        ))}
      <Button
        disabled={busy || !!receiptId || selected.length < 2}
        onClick={() => void prepare()}
      >
        Verifiko përzgjedhjen
      </Button>
      {prepared && (
        <fieldset disabled={busy || !!receiptId}>
          <legend>Konfirmim i daljes fizike</legend>
          <p>
            {prepared
              .map((row) => "Nr. " + row.number + " (r" + row.revision + ")")
              .join(", ")}
          </p>
          <label>
            Mënyra e dorëzimit për të gjithë lotin
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as typeof mode);
                setConfirmed(false);
              }}
            >
              <option value="laboratory_delivery">
                Dorëzim nga laboratori
              </option>
              <option value="clinic_pickup">Tërheqje nga klinika</option>
              <option value="external_courier">Korrier i jashtëm</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Konfirmoj daljen fizike të të gjitha porosive të listuara. Nuk
            dërgohet e-mail.
          </label>
          <Button disabled={!confirmed} onClick={() => void deliver()}>
            Dorëzo të gjithë lotin
          </Button>
        </fieldset>
      )}
      <div>
        <label>
          Identifikuesi i faturës për verifikim, edhe pas ringarkimit
          <input
            value={receiptId ?? ""}
            autoComplete="off"
            maxLength={36}
            onChange={(e) => {
              setReceiptId(e.target.value || null);
              uncertain.current = e.target.value || null;
            }}
          />
        </label>
        <Button disabled={busy || !receiptId} onClick={() => void lookup()}>
          Kontrollo faturën
        </Button>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
