import { useEffect, useRef, useState } from "react";
import type {
  EffectivePermissionsSchema,
  OrderReviewPageSchema,
} from "@dental-lab/contracts";
import { createOrderDecisionClient } from "./decision-api.js";
import { Button } from "../../shared/Button.js";
type Page = ReturnType<typeof OrderReviewPageSchema.parse>;
const api = createOrderDecisionClient();
const statusLabels = {
  pending: "Në pritje",
  accepted: "E pranuar",
  rejected: "E refuzuar",
  manufacturing: "Në prodhim",
};
const blocked = {
  catalog_forbidden: "Referencë e ndaluar: nuk ka përjashtim.",
  catalog_missing: "Referencat historike kërkojnë verifikim.",
  security_block: "Puna ka bllokim sigurie.",
  pending_request: "Ka kërkesë në pritje për ndryshim ose anulim.",
  files_not_ready: "Skedarët kërkojnë verifikim përpara vazhdimit.",
};
export function OrderReviewPanel({
  permissions,
}: {
  permissions: ReturnType<
    typeof EffectivePermissionsSchema.parse
  >["permissions"];
}) {
  const [page, setPage] = useState<Page | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState(false),
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
  const item = page?.items.find((row) => row.id === selected);
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
        setPage(null);
        setSelected(null);
        setMessage(
          "Rezultati nuk u verifikua. Ringarkoni listën përpara një vendimi tjetër; veprimi nuk përsëritet automatikisht.",
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
    await run(async (signal) => {
      const next = await api.list(signal, after);
      if (!signal.aborted) {
        setPage(next);
        setSelected(null);
        setReason("");
        setConfirm(false);
      }
    });
  }
  async function decide(action: "accept" | "reject" | "start_manufacturing") {
    if (!item) return;
    const base = {
      order_id: item.id,
      expected_version_id: item.version_id,
      expected_revision: item.revision,
    };
    const command =
      action === "accept"
        ? {
            ...base,
            action,
            confirm_unavailable: confirm,
            ...(reason.trim() ? { reason: reason.trim() } : {}),
          }
        : action === "reject"
          ? { ...base, action, reason: reason.trim() }
          : { ...base, action };
    await run(async (signal) => {
      const result = await api.decide(command, signal);
      if (signal.aborted) return;
      setPage(null);
      setSelected(null);
      setReason("");
      setConfirm(false);
      setMessage(
        result.kind === "updated"
          ? "Porosia nr. " +
              item.number +
              ": " +
              statusLabels[result.status] +
              ". Ringarkoni listën."
          : result.kind === "blocked"
            ? blocked[result.reason]
            : result.kind === "exception_required"
              ? "Pranimi i referencës së padisponueshme kërkon konfirmim dhe arsyetim. Ringarkoni dhe shqyrtoni porosinë."
              : "Versioni ose statusi ndryshoi. Ringarkoni përpara vendimit.",
      );
    });
  }
  return (
    <section aria-label="Shqyrtimi i porosive">
      <h3>Shqyrtimi i porosive</h3>
      <p>
        Lexoni versionin aktual përpara vendimit. Ndryshimi i katalogut nuk
        ndryshon etiketat historike më poshtë.
      </p>
      <Button disabled={busy} onClick={() => void load()}>
        Ngarko porositë në pritje / të pranuara
      </Button>
      {page?.next_after && (
        <Button
          disabled={busy}
          onClick={() => void load(page.next_after ?? undefined)}
        >
          Faqja tjetër
        </Button>
      )}
      {page && (
        <ul>
          {page.items.map((row) => (
            <li key={row.id}>
              <Button
                disabled={busy}
                onClick={() => {
                  setSelected(row.id);
                  setReason("");
                  setConfirm(false);
                  setMessage("");
                }}
              >
                Nr. {row.number} · {row.clinic_name} ·{" "}
                {statusLabels[row.status]}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {page?.items.length === 0 && <p>Nuk ka porosi në këtë faqe.</p>}
      {item && (
        <fieldset disabled={busy}>
          <legend>
            Porosia nr. {item.number} · rishikimi {item.revision}
          </legend>
          <p>
            {item.kind === "retouch" ? "Retushim" : "Punë normale"} ·{" "}
            {item.origin === "clinic"
              ? "Nga klinika"
              : "Krijuar nga laboratori"}
          </p>
          <p>
            Pacienti:{" "}
            {[item.patient.first_name, item.patient.last_name]
              .filter(Boolean)
              .join(" ")}{" "}
            · Referenca: {item.patient.internal_reference ?? "—"}
          </p>
          <p>
            Materiali: {item.material} · Ngjyra: {item.shade} · Lloji:{" "}
            {item.work_type ?? "—"}
          </p>
          <p>
            Data e dëshiruar: {item.requested_delivery_date ?? "—"}. Nuk është
            data e planifikuar.
          </p>
          <p style={{ whiteSpace: "pre-wrap" }}>
            Përshkrimi: {item.description || "—"}
          </p>
          <p>
            Dhëmbët:{" "}
            {item.teeth
              .map(
                (t) =>
                  t.fdi + " " + (t.selection === "pontic" ? "antar" : "normal"),
              )
              .join(", ") || "—"}
          </p>
          <p>
            Skedarë: {item.file_count}.{" "}
            {item.security_block
              ? "Bllokim sigurie aktiv."
              : "Gjendja kontrollohet sërish në server."}
          </p>
          <label>
            Arsyetimi (i detyrueshëm për refuzim dhe përjashtim)
            <textarea
              value={reason}
              maxLength={2000}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {item.status === "pending" && (
            <>
              {permissions.includes("orders.accept") && (
                <>
                  <label>
                    <input
                      type="checkbox"
                      checked={confirm}
                      onChange={(e) => setConfirm(e.target.checked)}
                    />
                    Konfirmoj pranimin përjashtimor nëse referenca është e
                    padisponueshme; arsyetimi më sipër zbatohet.
                  </label>
                  <Button onClick={() => void decide("accept")}>
                    Prano versionin e shfaqur
                  </Button>
                </>
              )}
              {permissions.includes("orders.reject") && (
                <Button
                  disabled={!reason.trim()}
                  onClick={() => void decide("reject")}
                >
                  Refuzo me arsyetim
                </Button>
              )}
            </>
          )}
          {item.status === "accepted" &&
            permissions.includes("orders.start_manufacturing") && (
              <Button onClick={() => void decide("start_manufacturing")}>
                Fillo prodhimin dhe blloko udhëzimet
              </Button>
            )}
        </fieldset>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
