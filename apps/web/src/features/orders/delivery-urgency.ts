import type { StatusSchema } from "@dental-lab/contracts";

type Status = ReturnType<typeof StatusSchema.parse>;
export type DeliveryUrgency = {
  level: "soon" | "late";
  provisional: boolean;
};

// Civil days in the laboratory's timezone; UTC arithmetic avoids DST-length days.
export function deliveryUrgency(
  status: Status,
  planned: string | null,
  requested: string | null,
  now: Date = new Date(),
): DeliveryUrgency | null {
  if (["delivered", "rejected", "cancelled"].includes(status)) return null;
  const date = planned ?? requested;
  if (!date) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (part: string) =>
    Number(parts.find((p) => p.type === part)?.value);
  const today = Date.UTC(get("year"), get("month") - 1, get("day"));
  const due = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(due)) return null;
  const days = Math.round((due - today) / 86_400_000);
  if (days > 2) return null;
  return { level: days < 0 ? "late" : "soon", provisional: !planned };
}

export function deliveryUrgencyLabel(value: DeliveryUrgency): string {
  return `${value.level === "late" ? "Vonesë" : "Afat brenda 2 ditësh"}${value.provisional ? " · sipas datës së dëshiruar (e përkohshme)" : " · sipas datës së planifikuar"}`;
}
