import { useEffect, useMemo, useRef, useState } from "react";
import type {
  OrderTrackingPage,
  DeliveryPlanContext,
} from "@dental-lab/contracts";
import { createDeliveryPlanClient } from "./delivery-plan-api.js";
import { DeliveryPlanPanel } from "./DeliveryPlanPanel.js";
import { Button } from "../../shared/Button.js";
import {
  calendarPeriod,
  laboratoryToday,
  shiftCalendar,
} from "./calendar-period.js";
import type { CalendarMode } from "./calendar-period.js";
import { createOrderTrackingClient } from "./tracking-api.js";
import { orderStatusLabels } from "./status-labels.js";
const api = createOrderTrackingClient();
const planClient = createDeliveryPlanClient();
type Page = OrderTrackingPage;
type Period = ReturnType<typeof calendarPeriod>;
const dayLabel = (day: string) =>
  new Intl.DateTimeFormat("sq-AL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));

function CalendarResults({
  period,
  onOpen,
  onReload,
  onPlanUpdated,
  allowPlan,
}: {
  period: Period;
  onOpen: (id: string) => void;
  onReload: () => void;
  onPlanUpdated: () => void;
  allowPlan: boolean;
}) {
  const [page, setPage] = useState<Page | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<{
    context: DeliveryPlanContext;
    target: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    void api
      .search(
        { date_kind: "effective", from: period.from, to: period.to },
        controller.signal,
      )
      .then((result) => {
        if (!controller.signal.aborted) setPage(result);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Kalendari nuk u verifikua. Provoni përsëri.");
      })
      .finally(() => {
        if (active.current === controller) {
          active.current = null;
          setBusy(false);
        }
      });
    return () => active.current?.abort();
  }, [period.from, period.to]);
  async function loadMore(after: string) {
    if (active.current || !page) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    try {
      const next = await api.search(
        { date_kind: "effective", from: period.from, to: period.to, after },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (
        next.can_read_details !== page.can_read_details ||
        (next.next_after && next.next_after === after)
      )
        throw new Error("CALENDAR_PAGE_CONFLICT");
      setPage({ ...next, items: [...page.items, ...next.items] });
    } catch {
      if (!controller.signal.aborted) {
        setPage(null);
        setError("Faqet nuk u verifikuan; ringarkoni periudhën.");
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  async function propose(orderId: string, target: string) {
    if (!allowPlan || active.current || proposal || !page) return;
    const item = page.items.find((row) => row.id === orderId);
    if (!item || ["delivered", "rejected", "cancelled"].includes(item.status))
      return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 8000);
    try {
      const context = await planClient.context(orderId, controller.signal);
      if (controller.signal.aborted) {
        if (timedOut)
          setError("Planifikimi nuk u verifikua. Ringarkoni periudhën.");
        return;
      }
      if (["delivered", "rejected", "cancelled"].includes(context.status)) {
        setError("Porosia u mbyll. Ringarkoni periudhën.");
      } else if (context.planned_delivery_date !== target) {
        setProposal({ context, target });
      }
    } catch {
      if (timedOut || !controller.signal.aborted)
        setError("Planifikimi nuk u verifikua. Ringarkoni periudhën.");
    } finally {
      clearTimeout(timer);
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  async function confirmPlan() {
    if (!proposal || active.current) return;
    const { context, target } = proposal;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 8000);
    try {
      const result = await planClient.update(
        {
          order_id: context.order_id,
          expected_version_id: context.version_id,
          expected_order_revision: context.order_revision,
          expected_logistics_revision: context.logistics_revision,
          planned_delivery_date: target,
        },
        controller.signal,
      );
      if (controller.signal.aborted) {
        if (timedOut) {
          setProposal(null);
          setPage(null);
          setError(
            "Rezultati nuk u verifikua. Ringarkoni periudhën; mos e përsërisni automatikisht.",
          );
        }
        return;
      }
      setProposal(null);
      if (result.kind === "updated") onPlanUpdated();
      else {
        setPage(null);
        setError(
          result.kind === "unchanged"
            ? "Data nuk ndryshoi. Ringarkoni periudhën."
            : "Statusi ose versioni ndryshoi. Ringarkoni periudhën.",
        );
      }
    } catch {
      if (timedOut || !controller.signal.aborted) {
        setProposal(null);
        setPage(null);
        setError(
          "Rezultati nuk u verifikua. Ringarkoni periudhën; mos e përsërisni automatikisht.",
        );
      }
    } finally {
      clearTimeout(timer);
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <div aria-busy={busy}>
      {busy && !page && <p>Kalendari po ngarkohet…</p>}
      {error && <p role="alert">{error}</p>}
      {error && <Button onClick={onReload}>Ringarko periudhën</Button>}
      {page && (
        <>
          <div className="delivery-calendar">
            {period.days.map((day) => {
              const orders = page.items.filter(
                (item) =>
                  (item.planned_delivery_date ??
                    item.requested_delivery_date) === day,
              );
              return (
                <section
                  className="calendar-day"
                  key={day}
                  aria-label={day}
                  onDragOver={
                    allowPlan ? (event) => event.preventDefault() : undefined
                  }
                  onDrop={
                    allowPlan
                      ? (event) => {
                          event.preventDefault();
                          void propose(
                            event.dataTransfer.getData("text/plain"),
                            day,
                          );
                        }
                      : undefined
                  }
                >
                  <h4>{dayLabel(day)}</h4>
                  {orders.length === 0 && <p className="muted">—</p>}
                  {orders.map((item) => (
                    <div
                      className="calendar-work"
                      key={item.id}
                      draggable={
                        allowPlan &&
                        !["delivered", "rejected", "cancelled"].includes(
                          item.status,
                        )
                      }
                      onDragStart={
                        allowPlan
                          ? (event) => {
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", item.id);
                            }
                          : undefined
                      }
                    >
                      <strong>Nr. {item.number}</strong> · {item.clinic_name}
                      <br />
                      {orderStatusLabels[item.status]}
                      {item.planned_delivery_date ? "" : " · E përkohshme"}
                      {page.can_read_details && (
                        <>
                          <br />
                          <Button onClick={() => onOpen(item.id)}>
                            Hap detajet
                          </Button>
                        </>
                      )}
                      {allowPlan &&
                        !["delivered", "rejected", "cancelled"].includes(
                          item.status,
                        ) && (
                          <>
                            <br />
                            <Button onClick={() => setEditingId(item.id)}>
                              Ndrysho datën
                            </Button>
                          </>
                        )}
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
          {proposal && (
            <div role="group" aria-label="Konfirmo datën e planifikuar">
              <p>
                Nr.{" "}
                {
                  page.items.find(
                    (item) => item.id === proposal.context.order_id,
                  )?.number
                }
                . Data e planifikuar:{" "}
                {proposal.context.planned_delivery_date ?? "pa plan"} →{" "}
                {proposal.target}. Data e dëshiruar mbetet{" "}
                {proposal.context.requested_delivery_date}.
              </p>
              <Button disabled={busy} onClick={() => void confirmPlan()}>
                Konfirmo ndryshimin
              </Button>
              <Button disabled={busy} onClick={() => setProposal(null)}>
                Anulo
              </Button>
            </div>
          )}
          {editingId && allowPlan && (
            <section aria-label="Ndrysho datën në detaj">
              <Button onClick={() => setEditingId(null)}>
                Mbyll formularin
              </Button>
              <DeliveryPlanPanel key={editingId} orderId={editingId} />
              <p>Pas ruajtjes, ringarkoni kalendarin për të parë datën e re.</p>
            </section>
          )}
          {page.next_after && (
            <>
              <p>
                Kjo periudhë ka faqe të tjera; numrat e shfaqur nuk përfaqësojnë
                të gjitha punët.
              </p>
              <Button
                disabled={busy}
                onClick={() => void loadMore(page.next_after!)}
              >
                Ngarko faqen tjetër
              </Button>
            </>
          )}
          {!page.next_after && page.items.length === 0 && (
            <p>Nuk ka punë në këtë periudhë.</p>
          )}
        </>
      )}
    </div>
  );
}

export function DeliveryCalendar({
  onOpen,
  allowPlan,
}: {
  onOpen: (id: string) => void;
  allowPlan: boolean;
}) {
  const [mode, setMode] = useState<CalendarMode>("week");
  const [notice, setNotice] = useState("");
  const [anchor, setAnchor] = useState(() => laboratoryToday());
  const [reload, setReload] = useState(0);
  const period = useMemo(() => calendarPeriod(mode, anchor), [mode, anchor]);
  return (
    <section aria-label="Kalendari i punëve">
      <h3>Kalendari i punëve</h3>
      <div className="calendar-controls">
        <label>
          Pamja
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as CalendarMode)}
          >
            <option value="week">Java</option>
            <option value="month">Muaji</option>
          </select>
        </label>
        <Button onClick={() => setAnchor(shiftCalendar(mode, anchor, -1))}>
          Më parë
        </Button>
        <Button onClick={() => setAnchor(laboratoryToday())}>Sot</Button>
        <Button onClick={() => setAnchor(shiftCalendar(mode, anchor, 1))}>
          Më pas
        </Button>
      </div>
      <p>
        Periudha: {period.from} – {period.to}. Data e planifikuar ka përparësi;
        data e dëshiruar shënohet si e përkohshme.
      </p>
      {allowPlan && (
        <p>
          Në desktop: tërhiqni punën në datën e re dhe konfirmoni. Në telefon
          ose me tastierë: përdorni « Ndrysho datën ».
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <CalendarResults
        key={`${period.from}:${period.to}:${reload}`}
        period={period}
        onOpen={onOpen}
        allowPlan={allowPlan}
        onPlanUpdated={() => {
          setNotice("Data u ruajt në historik. Kalendari po ringarkohet.");
          setReload((current) => current + 1);
        }}
        onReload={() => {
          setNotice("");
          setReload((current) => current + 1);
        }}
      />
    </section>
  );
}
