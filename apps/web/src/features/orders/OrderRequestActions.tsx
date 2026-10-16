import { useEffect, useRef, useState } from "react";
import type {
  OrderRequestContextSchema,
  OrderCancellationRequest,
  EffectivePermissionsSchema,
} from "@dental-lab/contracts";
import { createOrderRequestClient } from "./request-api.js";
import { Button } from "../../shared/Button.js";
const api = createOrderRequestClient();
export function OrderRequestActions({
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
  onFinished: (message: string) => void;
}) {
  const [context, setContext] = useState<ReturnType<
      typeof OrderRequestContextSchema.parse
    > | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false);
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
    const timer = setTimeout(() => c.abort(), 8000);
    try {
      await work(c.signal);
    } catch {
      if (pending.current === c) {
        setContext(null);
        onFinished(
          "Rezultati i kërkesës nuk u verifikua. Ringarkoni porosinë; nuk ka përsëritje automatike.",
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
      const c = await api.context(orderId, signal);
      if (!signal.aborted) {
        setContext(c);
        setConfirmed(false);
        setReason("");
      }
    });
  }
  async function act(action: OrderCancellationRequest["action"]) {
    if (!context) return;
    const command = {
      order_id: orderId,
      expected_version_id: context.order.version_id,
      expected_revision: context.order.revision,
      action,
      ...(action !== "request_cancellation" && context.pending
        ? {
            request_id: context.pending.id,
            expected_request_revision: context.pending.revision,
          }
        : {}),
      ...(action !== "reject_cancellation" ? { confirmed } : {}),
      ...(action === "accept_cancellation" || action === "reject_cancellation"
        ? { reason: reason.trim() }
        : {}),
    };
    await run(async (signal) => {
      const r = await api.decide(command, signal);
      if (signal.aborted) return;
      setContext(null);
      const labels = {
        pending: "Kërkesa u regjistrua; porosia nuk u anulua.",
        withdrawn: "Kërkesa u tërhoq.",
        accepted: "Kërkesa u pranua dhe porosia u anulua.",
        rejected: "Kërkesa u refuzua; porosia mbetet e pranuar.",
      };
      onFinished(
        r.kind === "updated"
          ? labels[r.state] + " Ringarkoni listën."
          : r.kind === "pending_request"
            ? "Ka tashmë një kërkesë në pritje. Ringarkoni porosinë."
            : "Versioni, statusi ose kërkesa ndryshoi. Ringarkoni porosinë.",
      );
    });
  }
  if (!clinic && !permissions.includes("orders.cancel")) return null;
  return (
    <div>
      <Button disabled={busy} onClick={() => void load()}>
        Kërkesat e porosisë
      </Button>
      {context && (
        <fieldset disabled={busy}>
          <legend>Nr. {context.order.number} · Kërkesat</legend>
          {context.order.status !== "accepted" ? (
            <p>
              Kërkesat trajtohen vetëm për porositë e pranuara, përpara
              prodhimit.
            </p>
          ) : (
            <>
              {context.pending ? (
                <p>
                  Kërkesë në pritje:{" "}
                  {context.pending.kind === "cancellation"
                    ? "anulim"
                    : "ndryshim"}
                  . Fillimi i prodhimit është i bllokuar.
                </p>
              ) : (
                <p>Nuk ka kërkesë në pritje.</p>
              )}
              {clinic && !context.pending && (
                <Button
                  disabled={!confirmed}
                  onClick={() => void act("request_cancellation")}
                >
                  Kërko anulimin
                </Button>
              )}
              {clinic && context.pending && (
                <Button
                  disabled={!confirmed}
                  onClick={() => void act("withdraw")}
                >
                  Tërhiq kërkesën në pritje
                </Button>
              )}
              {!clinic && context.pending?.kind === "cancellation" && (
                <>
                  <label>
                    Arsyetimi
                    <textarea
                      maxLength={2000}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <Button
                    disabled={!confirmed || !reason.trim()}
                    onClick={() => void act("accept_cancellation")}
                  >
                    Prano anulimin
                  </Button>
                  <Button
                    disabled={!reason.trim()}
                    onClick={() => void act("reject_cancellation")}
                  >
                    Refuzo kërkesën
                  </Button>
                </>
              )}
              {!clinic && context.pending?.kind === "modification" && (
                <p>
                  Kjo kërkesë kërkon shqyrtim të ndryshimeve; nuk trajtohet si
                  anulim.
                </p>
              )}
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Konfirmoj veprimin e zgjedhur.
              </label>
            </>
          )}
        </fieldset>
      )}
    </div>
  );
}
