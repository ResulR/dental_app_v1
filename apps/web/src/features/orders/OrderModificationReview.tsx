import { useEffect, useRef, useState } from "react";
import type {
  OrderModificationContext,
  OrderEditView,
} from "@dental-lab/contracts";
import { createOrderModificationClient } from "./modification-api.js";
import { Button } from "../../shared/Button.js";
const api = createOrderModificationClient();
function values(v: OrderEditView) {
  return {
    Emri: v.input.patient.first_name ?? "—",
    Mbiemri: v.input.patient.last_name ?? "—",
    Referenca: v.input.patient.internal_reference ?? "—",
    "Data e dëshiruar": v.input.requested_delivery_date ?? "—",
    Materiali: v.labels.material,
    Ngjyra: v.labels.shade,
    Lloji: v.labels.work_type ?? "—",
    Përshkrimi: v.input.description ?? "—",
    Dhëmbët:
      v.input.teeth
        .map((t) => t.fdi + (t.selection === "pontic" ? " (pontik)" : ""))
        .join(", ") || "—",
  };
}
export function OrderModificationReview({
  orderId,
  clinic,
  onFinished,
}: {
  orderId: string;
  clinic: boolean;
  onFinished: (text: string) => void;
}) {
  const [context, setContext] = useState<OrderModificationContext | null>(null),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(""),
    [ack, setAck] = useState(false),
    [message, setMessage] = useState("");
  const pending = useRef<AbortController | null>(null);
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
        setContext(null);
        setMessage(
          "Nuk u verifikua një kërkesë ndryshimi në pritje. Ringarkoni porosinë; nuk ka përsëritje automatike.",
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
    await run(async (signal) => {
      const next = await api.context(orderId, signal);
      if (!signal.aborted) {
        setContext(next);
        setReason("");
        setAck(false);
        setMessage("");
      }
    });
  }
  async function decide(action: "accept_modification" | "reject_modification") {
    if (!context) return;
    await run(async (signal) => {
      const r = await api.decide(
        {
          order_id: orderId,
          expected_version_id: context.base.current_version_id,
          expected_revision: context.base.revision,
          request_id: context.request_id,
          expected_request_revision: context.request_revision,
          action,
          ...(action === "accept_modification"
            ? { confirmed_warnings: ack }
            : { reason: reason.trim() }),
        },
        signal,
      );
      if (signal.aborted) return;
      if (r.kind === "confirmation_required") {
        setMessage(
          "Referencë e padisponueshme: shqyrtoni dhe konfirmoni paralajmërimin.",
        );
        return;
      }
      setContext(null);
      onFinished(
        r.kind === "updated"
          ? (action === "accept_modification"
              ? "Ndryshimi u pranua dhe u bë versioni zyrtar."
              : "Ndryshimi u refuzua; versioni zyrtar mbetet i pandryshuar.") +
              " Ringarkoni porosinë."
          : r.kind === "blocked"
            ? "Veprimi u bllokua nga kontrollet e katalogut, skedarëve ose sigurisë. Ringarkoni porosinë."
            : "Versioni ose kërkesa ndryshoi. Ringarkoni porosinë.",
      );
    });
  }
  const before = context ? values(context.base) : null,
    after = context ? values(context.proposal) : null;
  return (
    <div>
      <Button disabled={busy} onClick={() => void load()}>
        Shqyrto kërkesën e ndryshimit
      </Button>
      {context && before && after && (
        <fieldset disabled={busy}>
          <legend>Propozimi — Nr. {context.base.number}</legend>
          <p>
            Versioni zyrtar mbetet i pandryshuar deri në pranimin nga
            laboratori.
          </p>
          <table>
            <thead>
              <tr>
                <th>Fusha</th>
                <th>Para</th>
                <th>Propozimi</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(before) as (keyof typeof before)[]).map((key) => (
                <tr key={key}>
                  <th>{key}</th>
                  <td>{before[key]}</td>
                  <td>
                    {after[key]}
                    {before[key] !== after[key] ? " (ndryshuar)" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!clinic && (
            <>
              <label>
                Arsyeja e refuzimit
                <textarea
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                I shqyrtova paralajmërimet e disponueshmërisë.
              </label>
              <Button onClick={() => void decide("accept_modification")}>
                Prano ndryshimin
              </Button>
              <Button
                disabled={!reason.trim()}
                onClick={() => void decide("reject_modification")}
              >
                Refuzo ndryshimin
              </Button>
            </>
          )}
        </fieldset>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
