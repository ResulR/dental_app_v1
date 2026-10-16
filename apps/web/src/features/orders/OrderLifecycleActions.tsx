import { useEffect, useRef, useState } from "react";
import type {
  OrderLifecycleContextSchema,
  EffectivePermissionsSchema,
  OrderLifecycle,
} from "@dental-lab/contracts";
import { createOrderLifecycleClient } from "./lifecycle-api.js";
import { orderStatusLabels } from "./status-labels.js";
import { Button } from "../../shared/Button.js";
const api = createOrderLifecycleClient();
const reasons = {
  security_block: "Bllokim sigurie aktiv.",
  catalog_forbidden: "Referencë e ndaluar.",
  catalog_missing: "Katalogu kërkon verifikim.",
  files_not_ready: "Skedarët nuk janë verifikuar.",
  pending_request: "Ka kërkesë në pritje.",
  linked_retouch: "Ka retushim të lidhur; kthimi bllokohet.",
  active_retouch: "Një tjetër retushim është aktiv; kthimi bllokohet.",
};
export function OrderLifecycleActions({
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
      typeof OrderLifecycleContextSchema.parse
    > | null>(null),
    [reason, setReason] = useState(""),
    [mode, setMode] = useState("laboratory_delivery"),
    [confirmed, setConfirmed] = useState(false),
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
      if (pending.current === c) {
        setContext(null);
        onFinished(
          "Rezultati nuk u verifikua. Ringarkoni porosinë përpara një veprimi tjetër; nuk ka përsëritje automatike.",
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
        setConfirmed(false);
      }
    });
  }
  async function act(action: OrderLifecycle["action"]) {
    if (!context) return;
    const command = {
      order_id: context.order_id,
      expected_version_id: context.version_id,
      expected_revision: context.revision,
      action,
      ...(action === "deliver"
        ? { confirmed, mode }
        : action === "cancel"
          ? { confirmed, ...(reason.trim() ? { reason: reason.trim() } : {}) }
          : action === "request_correction" || action === "correct_delivery"
            ? { reason: reason.trim() }
            : {}),
    };
    await run(async (signal) => {
      const result = await api.decide(command, signal);
      if (signal.aborted) return;
      setContext(null);
      onFinished(
        result.kind === "updated"
          ? "Porosia nr. " +
              context.number +
              ": " +
              orderStatusLabels[result.status] +
              ". Ringarkoni listën."
          : result.kind === "blocked"
            ? reasons[result.reason] + " Ringarkoni porosinë."
            : "Versioni ose statusi ndryshoi. Ringarkoni porosinë.",
      );
    });
  }
  const can = (p: (typeof permissions)[number]) =>
    !clinic && permissions.includes(p);
  return (
    <div>
      <Button disabled={busy} onClick={() => void load()}>
        Ngarko veprimet e porosisë
      </Button>
      {context && (
        <fieldset disabled={busy}>
          <legend>
            Nr. {context.number} · {orderStatusLabels[context.status]} · r
            {context.revision}
          </legend>
          <p>
            Veprimet zbatohen vetëm mbi versionin e ngarkuar. Udhëzimet
            historike nuk ndryshohen.
          </p>
          <label>
            Arsyetimi
            <textarea
              value={reason}
              maxLength={2000}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {context.status === "manufacturing" &&
            can("orders.change_status") && (
              <Button onClick={() => void act("complete")}>
                Shëno si të përfunduar
              </Button>
            )}
          {context.status === "completed" && can("delivery.mark_delivered") && (
            <>
              <label>
                Mënyra e dorëzimit
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="laboratory_delivery">
                    Dorëzim nga laboratori
                  </option>
                  <option value="clinic_pickup">Tërheqje nga klinika</option>
                  <option value="external_courier">Korrier i jashtëm</option>
                </select>
              </label>
              <p>
                Konfirmoni daljen fizike nga laboratori. Nuk dërgohet e-mail për
                dorëzimin.
              </p>
              <Button disabled={!confirmed} onClick={() => void act("deliver")}>
                Shëno si të dorëzuar
              </Button>
            </>
          )}
          {context.status === "delivered" && can("delivery.correct") && (
            <Button
              disabled={!reason.trim()}
              onClick={() => void act("correct_delivery")}
            >
              Korrigjo dorëzimin: kthe në të përfunduar
            </Button>
          )}
          {context.status === "pending" && can("orders.request_correction") && (
            <Button
              disabled={!reason.trim()}
              onClick={() => void act("request_correction")}
            >
              Kërko korrigjim me arsyetim
            </Button>
          )}
          {(clinic
            ? ["pending", "correction_requested"].includes(context.status)
            : can("orders.cancel") &&
              [
                "pending",
                "correction_requested",
                "accepted",
                "manufacturing",
              ].includes(context.status)) && (
            <Button
              disabled={!confirmed || (!clinic && !reason.trim())}
              onClick={() => void act("cancel")}
            >
              Anulo porosinë
            </Button>
          )}
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Konfirmoj anulimin ose daljen fizike, sipas veprimit të zgjedhur.
          </label>
        </fieldset>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
