import { deliveryUrgency, deliveryUrgencyLabel } from "./delivery-urgency.js";
import { DeliveryCalendar } from "./DeliveryCalendar.js";
import { ReadyDeliveryBatch } from "./ReadyDeliveryBatch.js";
import { DeliveryPriorityPanel } from "./DeliveryPriorityPanel.js";
import { DeliveryPlanPanel } from "./DeliveryPlanPanel.js";
import { OrderFilesPanel } from "./OrderFilesPanel.js";
import { LaboratoryLinkedWorkForm } from "./LaboratoryLinkedWorkForm.js";
import { LinkedWorkPanel } from "./LinkedWorkPanel.js";
import { OrderRetouchForm } from "./OrderRetouchForm.js";
import { ClinicOrderForm } from "./ClinicOrderForm.js";
import { createOrderEditClient } from "./edit-api.js";
import { showRetouchEntry } from "./retouch-entry.js";
import { appendOrderHistory } from "./order-history-page.js";
import { appendTrackingPage } from "./tracking-page.js";
import { OrderEditPanel } from "./OrderEditPanel.js";
import { OrderRequestActions } from "./OrderRequestActions.js";
import { OrderLifecycleActions } from "./OrderLifecycleActions.js";
import type { EffectivePermissionsSchema } from "@dental-lab/contracts";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { OrderSearchSchema, orderIdFromFragment } from "@dental-lab/contracts";
import type {
  OrderTrackingPageSchema,
  OrderTrackingDetailSchema,
  StatusSchema,
  OrderEditView,
} from "@dental-lab/contracts";
import { createOrderTrackingClient } from "./tracking-api.js";
import { orderStatusLabels } from "./status-labels.js";
import { Button } from "../../shared/Button.js";
import type { ReactNode } from "react";
const api = createOrderTrackingClient();
const editApi = createOrderEditClient();
type Status = ReturnType<typeof StatusSchema.parse>;
export function OrderTrackingPanel({
  clinic,
  permissions,
  renderConversation,
  initialSearchNumber,
  accountId,
  onInspectOrder,
}: {
  clinic: boolean;
  accountId: string;
  onInspectOrder?: (number: string) => void;
  initialSearchNumber?: string;
  permissions: ReturnType<
    typeof EffectivePermissionsSchema.parse
  >["permissions"];
  renderConversation?: (orderId: string) => ReactNode;
}) {
  const [q, setQ] = useState(initialSearchNumber ?? ""),
    [status, setStatus] = useState(""),
    [kind, setKind] = useState(""),
    [workType, setWorkType] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [dateKind, setDateKind] = useState("requested"),
    [view, setView] = useState("active"),
    [clock, setClock] = useState(() => new Date()),
    [busy, setBusy] = useState(false),
    [readyOnly, setReadyOnly] = useState(false),
    [displayedView, setDisplayedView] = useState("active"),
    [message, setMessage] = useState("");
  const [duplicate, setDuplicate] = useState<OrderEditView | null>(null);
  const [chatOrder, setChatOrder] = useState<{
    id: string;
    number: string;
  } | null>(null);
  const [retouchReceipt, setRetouchReceipt] = useState<{
    id: string;
    number: string;
    sourceNumber: string;
  } | null>(null);
  const canReadChat =
    import.meta.env.VITE_DENTAL_LAB_ORDER_MESSAGING_ENABLED === "true" &&
    (clinic || permissions.includes("messaging.order.read"));
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
  async function search(
    after?: string,
    ready = false,
    archive = false,
    production?: "accepted" | "manufacturing",
  ) {
    const raw = archive
      ? { view: "archive", date_kind: "requested" }
      : ready
        ? { status: "completed", view: "active", date_kind: "requested" }
        : production
          ? { status: production, view: "active", date_kind: "requested" }
          : after
            ? { ...lastQuery.current, after }
            : {
                ...(q.trim() ? { q: q.trim() } : {}),
                ...(status ? { status } : {}),
                ...(kind ? { kind } : {}),
                ...(workType.trim() ? { work_type: workType.trim() } : {}),
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
        if (after && page && !readyOnly) {
          const merged = appendTrackingPage(page, next, after);
          if (!merged) throw new Error("ORDER_SEARCH_PERMISSION_CHANGED");
          setPage(merged);
        } else setPage(next);
        setDisplayedView(parsed.data.view);
        setReadyOnly(ready || (!!after && readyOnly && !archive));
        setDetail(null);
        setChatOrder(null);
        if (archive) {
          setView("archive");
          setStatus("");
          setQ("");
          setKind("");
          setWorkType("");
          setFrom("");
          setTo("");
          setDateKind("requested");
        }
        if (production) {
          setView("active");
          setStatus(production);
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
    const expected = detail;
    await run(async (signal) => {
      const next = await api.detail(
        { order_id, ...(before_revision ? { before_revision } : {}) },
        signal,
      );
      if (signal.aborted) return;
      if (next.order.id !== order_id) throw new Error("ORDER_DETAIL_SCOPE");
      if (before_revision && expected) {
        const merged = appendOrderHistory(expected, next, before_revision);
        if (!merged) throw new Error("ORDER_HISTORY_CHANGED");
        setDetail((current) => (current === expected ? merged : current));
      } else setDetail(next);
      setChatOrder(null);
    });
  }
  const followOrderLink = useEffectEvent((id: string) => {
    pending.current?.abort();
    pending.current = null;
    setDuplicate(null);
    setPage(null);
    setDetail(null);
    setChatOrder(null);
    setRetouchReceipt(null);
    void open(id);
  });
  useEffect(() => {
    function follow() {
      const id = orderIdFromFragment(window.location.hash);
      if (!id) return;
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
      followOrderLink(id);
    }
    const timer = window.setTimeout(follow, 0);
    window.addEventListener("hashchange", follow);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", follow);
    };
  }, []);
  function orderActions(orderId: string) {
    function finished(text: string) {
      setPage(null);
      setDetail(null);
      setMessage(text);
    }
    const props = { orderId, clinic, permissions, onFinished: finished };
    return (
      <div key={orderId}>
        <OrderEditPanel {...props} />
        <OrderRequestActions {...props} />
        <OrderLifecycleActions {...props} />
      </div>
    );
  }
  async function startDuplicate(orderId: string) {
    setDuplicate(null);
    await run(async (signal) => {
      const source = await editApi.context({ order_id: orderId }, signal);
      if (signal.aborted) return;
      if (
        source.order_id !== orderId ||
        !["rejected", "cancelled"].includes(source.status) ||
        source.version_id !== source.current_version_id
      )
        throw new Error("DUPLICATION_SOURCE_UNAVAILABLE");
      setDuplicate(source);
    });
  }
  return (
    <section id="order-tracking" aria-label="Ndjekja e porosive">
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
          {(clinic || permissions.includes("orders.read_details")) && (
            <label>
              Lloji i punës
              <input
                autoComplete="off"
                value={workType}
                maxLength={120}
                onChange={(e) => setWorkType(e.target.value)}
              />
            </label>
          )}
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
      {!clinic &&
        (permissions.includes("orders.start_manufacturing") ||
          permissions.includes("orders.change_status")) && (
          <div>
            {permissions.includes("orders.start_manufacturing") && (
              <Button
                disabled={busy}
                onClick={() => void search(undefined, false, false, "accepted")}
              >
                Punët e pranuara për fillim
              </Button>
            )}
            {permissions.includes("orders.change_status") && (
              <Button
                disabled={busy}
                onClick={() =>
                  void search(undefined, false, false, "manufacturing")
                }
              >
                Punët në prodhim
              </Button>
            )}
          </div>
        )}
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
      {clinic && retouchReceipt && (
        <div>
          <p role="status">
            Retushimi Nr. {retouchReceipt.number} u regjistrua si punë më vete
            {retouchReceipt.sourceNumber
              ? ` për porosinë Nr. ${retouchReceipt.sourceNumber}`
              : " për punën burim"}
            . Në pritje të vendimit të laboratorit.
          </p>
          <Button disabled={busy} onClick={() => void open(retouchReceipt.id)}>
            Hap ndjekjen e retushimit Nr. {retouchReceipt.number}
          </Button>
        </div>
      )}
      {page &&
        readyOnly &&
        !clinic &&
        permissions.includes("delivery.mark_delivered") &&
        import.meta.env.VITE_DENTAL_LAB_DELIVERY_BATCH_ENABLED === "true" && (
          <ReadyDeliveryBatch
            accountId={accountId}
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
                {row.origin === "laboratory" && " · Krijuar nga laboratori"}
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
              {showRetouchEntry(
                clinic,
                row.status,
                row.id,
                detail?.order.id,
                "list",
              ) && (
                <OrderRetouchForm
                  accountId={accountId}
                  sourceId={row.id}
                  onFinished={(receipt) => {
                    setPage(null);
                    setDetail(null);
                    setRetouchReceipt(receipt);
                    setMessage("");
                  }}
                />
              )}
              {clinic && ["rejected", "cancelled"].includes(row.status) && (
                <Button
                  disabled={busy}
                  onClick={() => void startDuplicate(row.id)}
                >
                  Përgatit porosi të re nga Nr. {row.number}
                </Button>
              )}
              <LinkedWorkPanel
                orderId={row.id}
                onOpen={(id) => void open(id)}
              />
              {detail?.order.id !== row.id && orderActions(row.id)}
              {canReadChat && (
                <Button
                  type="button"
                  onClick={() =>
                    setChatOrder((current) =>
                      current?.id === row.id
                        ? null
                        : { id: row.id, number: row.number },
                    )
                  }
                >
                  {chatOrder?.id === row.id ? "Mbyll bisedën" : "Hap bisedën"}
                </Button>
              )}
              {page.can_read_details && (
                <Button disabled={busy} onClick={() => void open(row.id)}>
                  Hap detajet
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {duplicate && (
        <ClinicOrderForm
          key={`${duplicate.order_id}-${duplicate.revision}`}
          accountId={accountId}
          duplicateSource={duplicate}
          {...(onInspectOrder ? { onInspectOrder } : {})}
        />
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
          {orderActions(detail.order.id)}
          {showRetouchEntry(
            clinic,
            detail.order.status,
            detail.order.id,
            detail.order.id,
            "detail",
          ) && (
            <OrderRetouchForm
              accountId={accountId}
              key={detail.order.id}
              sourceId={detail.order.id}
              onFinished={(receipt) => {
                setPage(null);
                setDetail(null);
                setRetouchReceipt(receipt);
                setMessage("");
              }}
            />
          )}
          <LinkedWorkPanel
            key={detail.order.id}
            orderId={detail.order.id}
            onOpen={(id) => void open(id)}
          />
          {canReadChat && (
            <Button
              type="button"
              onClick={() =>
                setChatOrder((current) =>
                  current?.id === detail.order.id
                    ? null
                    : { id: detail.order.id, number: detail.order.number },
                )
              }
            >
              {chatOrder?.id === detail.order.id
                ? "Mbyll bisedën"
                : "Hap bisedën e porosisë"}
            </Button>
          )}
          <p>
            {detail.order.clinic_name} · Marrë më {detail.order.received_at} ·
            Rishikimi {detail.order.revision}
          </p>
          <p>
            {detail.order.origin === "laboratory"
              ? "Krijuar nga laboratori"
              : "Krijuar nga klinika"}
            {detail.order.created_by &&
              ` · Llogaria e autorit: ${detail.order.created_by}`}
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
      {chatOrder && canReadChat && renderConversation && (
        <div>
          <h4>Biseda për porosinë nr. {chatOrder.number}</h4>
          {renderConversation(chatOrder.id)}
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
