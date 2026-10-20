import { useEffect, useMemo, useRef, useState } from "react";
import type { OrderTrackingPage } from "@dental-lab/contracts";
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
}: {
  period: Period;
  onOpen: (id: string) => void;
  onReload: () => void;
}) {
  const [page, setPage] = useState<Page | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
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
                <section className="calendar-day" key={day} aria-label={day}>
                  <h4>{dayLabel(day)}</h4>
                  {orders.length === 0 && <p className="muted">—</p>}
                  {orders.map((item) => (
                    <div className="calendar-work" key={item.id}>
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
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
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

export function DeliveryCalendar({ onOpen }: { onOpen: (id: string) => void }) {
  const [mode, setMode] = useState<CalendarMode>("week");
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
      <CalendarResults
        key={`${period.from}:${period.to}:${reload}`}
        period={period}
        onOpen={onOpen}
        onReload={() => setReload((current) => current + 1)}
      />
    </section>
  );
}
