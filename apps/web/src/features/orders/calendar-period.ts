export type CalendarMode = "week" | "month";
const DAY = 86_400_000;
const date = (value: string) => Date.parse(`${value}T00:00:00Z`);
const iso = (value: number) => new Date(value).toISOString().slice(0, 10);
export function laboratoryToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function calendarPeriod(mode: CalendarMode, anchor: string) {
  const first = mode === "month" ? `${anchor.slice(0, 7)}-01` : anchor;
  const start =
    date(first) - ((new Date(date(first)).getUTCDay() + 6) % 7) * DAY;
  const last =
    mode === "month"
      ? Date.UTC(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)), 0)
      : date(anchor);
  const end = last + ((7 - new Date(last).getUTCDay()) % 7) * DAY;
  const days = Array.from(
    { length: Math.round((end - start) / DAY) + 1 },
    (_, i) => iso(start + i * DAY),
  );
  return { from: iso(start), to: iso(end), days };
}
export function shiftCalendar(
  mode: CalendarMode,
  anchor: string,
  amount: number,
) {
  if (mode === "week") return iso(date(anchor) + amount * 7 * DAY);
  return iso(
    Date.UTC(
      Number(anchor.slice(0, 4)),
      Number(anchor.slice(5, 7)) - 1 + amount,
      1,
    ),
  );
}
