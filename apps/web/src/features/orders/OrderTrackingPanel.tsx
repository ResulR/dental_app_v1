import { OrderRequestActions } from "./OrderRequestActions.js";
import { OrderLifecycleActions } from "./OrderLifecycleActions.js";
import type { EffectivePermissionsSchema } from "@dental-lab/contracts";
import { useEffect, useRef, useState } from "react";
import { OrderSearchSchema } from "@dental-lab/contracts";
import type {
  OrderTrackingPageSchema,
  OrderTrackingDetailSchema,
  StatusSchema,
} from "@dental-lab/contracts";
import { createOrderTrackingClient } from "./tracking-api.js";
import { orderStatusLabels } from "./status-labels.js";
import { Button } from "../../shared/Button.js";
const api = createOrderTrackingClient();
type Status = ReturnType<typeof StatusSchema.parse>;
export function OrderTrackingPanel({
  clinic,
  permissions,
}: {
  clinic: boolean;
  permissions: ReturnType<
    typeof EffectivePermissionsSchema.parse
  >["permissions"];
}) {
  const [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [kind, setKind] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [dateKind, setDateKind] = useState("requested"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [page, setPage] = useState<ReturnType<
      typeof OrderTrackingPageSchema.parse
    > | null>(null),
    [detail, setDetail] = useState<ReturnType<
      typeof OrderTrackingDetailSchema.parse
    > | null>(null);
  const pending = useRef<AbortController | null>(null),
    lastQuery = useRef<ReturnType<typeof OrderSearchSchema.parse> | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [],
  );
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
        setDetail(null);
        setMessage(
          "Të dhënat nuk u verifikuan. Kontrolloni lidhjen dhe lejet, pastaj ringarkoni.",
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
  async function search(after?: string) {
    const raw = after
      ? { ...lastQuery.current, after }
      : {
          ...(q.trim() ? { q: q.trim() } : {}),
          ...(status ? { status } : {}),
          ...(kind ? { kind } : {}),
          date_kind: dateKind,
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        };
    const parsed = OrderSearchSchema.safeParse(raw);
    if (!parsed.success) {
      setMessage("Kontrolloni filtrat dhe intervalin e datave.");
      return;
    }
    await run(async (signal) => {
      const next = await api.search(parsed.data, signal);
      if (!signal.aborted) {
        lastQuery.current = parsed.data;
        setPage(next);
        setDetail(null);
      }
    });
  }
  async function open(order_id: string, before_revision?: number) {
    await run(async (signal) => {
      const next = await api.detail(
        { order_id, ...(before_revision ? { before_revision } : {}) },
        signal,
      );
      if (!signal.aborted) setDetail(next);
    });
  }
  return (
    <section aria-label="Ndjekja e porosive">
      <h3>Ndjekja e porosive</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <fieldset disabled={busy}>
          <legend>Kërkimi dhe filtrat</legend>
          <label>
            Numri, klinika ose pacienti (sipas lejeve)
            <input
              autoComplete="off"
              value={q}
              maxLength={120}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <label>
            Statusi
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Të gjitha</option>
              {Object.entries(orderStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Puna
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Të gjitha</option>
              <option value="normal">Normale</option>
              <option value="retouch">Retushim</option>
            </select>
          </label>
          <label>
            Data e filtruar
            <select
              value={dateKind}
              onChange={(e) => setDateKind(e.target.value)}
            >
              <option value="requested">E dëshiruar</option>
              <option value="planned">E planifikuar</option>
            </select>
          </label>
          <label>
            Nga
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Deri
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <Button type="submit">Kërko</Button>
        </fieldset>
      </form>
      {page && !page.can_read_details && (
        <p>
          Qasje logjistike: kërkimi i pacientit dhe udhëzimet nuk janë të
          disponueshme.
        </p>
      )}
      {page && (
        <ul>
          {page.items.map((row) => (
            <li key={row.id}>
              <p>
                Nr. {row.number} · {row.clinic_name} ·{" "}
                {orderStatusLabels[row.status]} ·{" "}
                {row.kind === "retouch" ? "Retushim" : "Normale"}
                {row.priority ? " · Prioritet" : ""}
              </p>
              <p>
                E dëshiruar: {row.requested_delivery_date ?? "—"} · E
                planifikuar: {row.planned_delivery_date ?? "—"}
              </p>
              <OrderRequestActions
                orderId={row.id}
                clinic={clinic}
                permissions={permissions}
                onFinished={(text) => {
                  setPage(null);
                  setDetail(null);
                  setMessage(text);
                }}
              />
              <OrderLifecycleActions
                orderId={row.id}
                clinic={clinic}
                permissions={permissions}
                onFinished={(text) => {
                  setPage(null);
                  setDetail(null);
                  setMessage(text);
                }}
              />
              {page.can_read_details && (
                <Button disabled={busy} onClick={() => void open(row.id)}>
                  Hap detajet
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {page?.items.length === 0 && <p>Nuk u gjet asnjë porosi.</p>}
      {page?.next_after && (
        <Button
          disabled={busy}
          onClick={() => void search(page.next_after ?? undefined)}
        >
          Faqja tjetër
        </Button>
      )}
      {detail && (
        <article>
          <h4>
            Porosia nr. {detail.order.number} ·{" "}
            {orderStatusLabels[detail.order.status]}
          </h4>
          <p>
            {detail.order.clinic_name} · Marrë më {detail.order.received_at} ·
            Rishikimi {detail.order.revision}
          </p>
          <p>
            Pacienti:{" "}
            {[detail.order.patient.first_name, detail.order.patient.last_name]
              .filter(Boolean)
              .join(" ")}{" "}
            · Referenca: {detail.order.patient.internal_reference ?? "—"}
          </p>
          <p>
            Materiali: {detail.order.material} · Ngjyra: {detail.order.shade} ·
            Lloji: {detail.order.work_type ?? "—"}
          </p>
          <p>
            E dëshiruar: {detail.order.requested_delivery_date ?? "—"} · E
            planifikuar: {detail.order.planned_delivery_date ?? "—"}
          </p>
          <p style={{ whiteSpace: "pre-wrap" }}>
            {detail.order.description || "Pa përshkrim."}
          </p>
          <p>
            Dhëmbët:{" "}
            {detail.order.teeth
              .map(
                (t) =>
                  t.fdi + " " + (t.selection === "pontic" ? "antar" : "normal"),
              )
              .join(", ") || "—"}
          </p>
          <p>
            Skedarë: {detail.order.file_count}.{" "}
            {detail.order.security_block ? "Bllokim sigurie aktiv." : ""}
          </p>
          <h4>Historiku i statuseve</h4>
          <ol>
            {detail.history.map((event) => (
              <li key={event.aggregate_revision}>
                {event.occurred_at} ·{" "}
                {event.previous_status
                  ? orderStatusLabels[event.previous_status as Status]
                  : "Krijimi"}{" "}
                → {orderStatusLabels[event.next_status]} · r
                {event.aggregate_revision}
                {event.reason && <p>{event.reason}</p>}
              </li>
            ))}
          </ol>
          {detail.next_before_revision && (
            <Button
              disabled={busy}
              onClick={() =>
                void open(
                  detail.order.id,
                  detail.next_before_revision ?? undefined,
                )
              }
            >
              Historiku më i vjetër
            </Button>
          )}
          <Button disabled={busy} onClick={() => void open(detail.order.id)}>
            Ringarko detajet aktuale
          </Button>
        </article>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
