import { deliveryUrgency, deliveryUrgencyLabel } from "./delivery-urgency.js";
import { DeliveryCalendar } from "./DeliveryCalendar.js";
import { ReadyDeliveryBatch } from "./ReadyDeliveryBatch.js";
import { DeliveryPriorityPanel } from "./DeliveryPriorityPanel.js";
import { DeliveryPlanPanel } from "./DeliveryPlanPanel.js";
import { OrderFilesPanel } from "./OrderFilesPanel.js";
import { LaboratoryLinkedWorkForm } from "./LaboratoryLinkedWorkForm.js";
import { LinkedWorkPanel } from "./LinkedWorkPanel.js";
import { OrderRetouchForm } from "./OrderRetouchForm.js";
import { OrderEditPanel } from "./OrderEditPanel.js";
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
    [view, setView] = useState("active"),
    [clock, setClock] = useState(() => new Date()),
    [busy, setBusy] = useState(false),
    [readyOnly, setReadyOnly] = useState(false),
    [displayedView, setDisplayedView] = useState("active"),
    [message, setMessage] = useState("");
  const [page, setPage] = useState<ReturnType<
      typeof OrderTrackingPageSchema.parse
    > | null>(null),
    [detail, setDetail] = useState<ReturnType<
      typeof OrderTrackingDetailSchema.parse
    > | null>(null);
  const pending = useRef<AbortController | null>(null),
    detailElement = useRef<HTMLElement | null>(null),
    lastQuery = useRef<ReturnType<typeof OrderSearchSchema.parse> | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [],
  );
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (detail) detailElement.current?.scrollIntoView({ block: "start" });
  }, [detail]);
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
  async function search(after?: string, ready = false, archive = false) {
    const raw = archive
      ? { view: "archive", date_kind: "requested" }
      : ready
        ? { status: "completed", view: "active", date_kind: "requested" }
        : after
          ? { ...lastQuery.current, after }
          : {
              ...(q.trim() ? { q: q.trim() } : {}),
              ...(status ? { status } : {}),
              ...(kind ? { kind } : {}),
              date_kind: dateKind,
              view,
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
        setDisplayedView(parsed.data.view);
        setReadyOnly(ready || (!!after && readyOnly && !archive));
        setDetail(null);
        if (archive) {
          setView("archive");
          setStatus("");
          setQ("");
          setKind("");
          setFrom("");
          setTo("");
          setDateKind("requested");
        }
        if (ready) {
          setView("active");
          setStatus("completed");
          setQ("");
          setKind("");
          setFrom("");
          setTo("");
          setDateKind("requested");
        }
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
      <DeliveryCalendar
        onOpen={(id) => void open(id)}
        allowPlan={
          !clinic &&
          permissions.includes("delivery.plan") &&
          import.meta.env.VITE_DENTAL_LAB_DELIVERY_PLAN_ENABLED === "true"
        }
      />
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
            Pamja
            <select value={view} onChange={(e) => setView(e.target.value)}>
              <option value="active">Punët aktive</option>
              <option value="archive">Arkivi pas 30 ditësh</option>
            </select>
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
      {!clinic && permissions.includes("delivery.mark_delivered") && (
        <div>
          <Button disabled={busy} onClick={() => void search(undefined, true)}>
            Punët gati për dorëzim
          </Button>
          <p>
            Vetëm punët e përfunduara. Mënyra dhe dalja fizike konfirmohen për
            çdo porosi pas ringarkimit të gjendjes.
          </p>
        </div>
      )}
      <Button
        disabled={busy}
        onClick={() => void search(undefined, false, true)}
      >
        Hap arkivin
      </Button>
      {page &&
        readyOnly &&
        !clinic &&
        permissions.includes("delivery.mark_delivered") &&
        import.meta.env.VITE_DENTAL_LAB_DELIVERY_BATCH_ENABLED === "true" && (
          <ReadyDeliveryBatch
            key={page.items.map((row) => row.id).join(":")}
            rows={page.items}
            onFinished={(text) => {
              setPage(null);
              setDetail(null);
              setMessage(text);
            }}
          />
        )}
      {page && displayedView === "archive" && (
        <p>
          Arkivi është pamje organizative pas 30 ditësh; porositë dhe historiku
          ruhen.
        </p>
      )}
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
              {(() => {
                const urgency = deliveryUrgency(
                  row.status,
                  row.planned_delivery_date,
                  row.requested_delivery_date,
                  clock,
                );
                return urgency ? <p>{deliveryUrgencyLabel(urgency)}</p> : null;
              })()}
              {clinic && row.status === "delivered" && (
                <OrderRetouchForm
                  sourceId={row.id}
                  onFinished={(text) => {
                    setPage(null);
                    setDetail(null);
                    setMessage(text);
                  }}
                />
              )}
              <LinkedWorkPanel
                orderId={row.id}
                onOpen={(id) => void open(id)}
              />
              <OrderEditPanel
                orderId={row.id}
                clinic={clinic}
                permissions={permissions}
                onFinished={(text) => {
                  setPage(null);
                  setDetail(null);
                  setMessage(text);
                }}
              />
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
        <article ref={detailElement}>
          {!clinic &&
            permissions.includes("orders.create_for_clinic") &&
            permissions.includes("linked_works.manage") &&
            ["manufacturing", "completed", "delivered"].includes(
              detail.order.status,
            ) && (
              <LaboratoryLinkedWorkForm
                key={detail.order.id + ":" + detail.order.revision}
                source={detail.order}
                canCancel={permissions.includes("orders.cancel")}
                onFinished={(text) => {
                  setPage(null);
                  setDetail(null);
                  setMessage(text);
                }}
              />
            )}
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
          {(() => {
            const urgency = deliveryUrgency(
              detail.order.status,
              detail.order.planned_delivery_date,
              detail.order.requested_delivery_date,
              clock,
            );
            return urgency ? <p>{deliveryUrgencyLabel(urgency)}</p> : null;
          })()}
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
          {!clinic &&
            permissions.includes("delivery.set_priority") &&
            import.meta.env.VITE_DENTAL_LAB_DELIVERY_PRIORITY_ENABLED ===
              "true" && (
              <DeliveryPriorityPanel
                key={detail.order.id}
                orderId={detail.order.id}
              />
            )}
          {!clinic &&
            permissions.includes("delivery.plan") &&
            import.meta.env.VITE_DENTAL_LAB_DELIVERY_PLAN_ENABLED ===
              "true" && (
              <DeliveryPlanPanel
                key={detail.order.id}
                orderId={detail.order.id}
              />
            )}
          {(clinic || permissions.includes("files.view")) && (
            <OrderFilesPanel
              key={detail.order.id + ":" + detail.order.version_id}
              orderId={detail.order.id}
              versionId={detail.order.version_id}
            />
          )}
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
