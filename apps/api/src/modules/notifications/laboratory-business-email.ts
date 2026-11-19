import { businessMailIntent } from "./business-event-policy.js";

// Generic copy only. Current recipient grants, event revision and delivery
// eligibility must be checked by an authorized dispatcher before transport.
const copy = {
  order_submitted: ["Porosi e re", "Një klinikë ka dërguar një porosi të re."],
  clinic_registered: [
    "Regjistrim i ri klinike",
    "Një klinikë ka kërkuar regjistrim.",
  ],
  modification_requested: [
    "Kërkesë për ndryshim",
    "Një klinikë ka kërkuar ndryshim të një porosie.",
  ],
  cancellation_requested: [
    "Kërkesë për anulim",
    "Një klinikë ka kërkuar anulim të një porosie.",
  ],
  retouch_requested: [
    "Kërkesë për retushim",
    "Një klinikë ka dërguar një kërkesë për retushim.",
  ],
  correction_resubmitted: [
    "Korrigjim i ridërguar",
    "Një klinikë ka ridërguar një korrigjim.",
  ],
} as const;

export function laboratoryBusinessEmail(input: {
  eventType: string;
  origin: string;
}): { subject: string; text: string } {
  if (
    businessMailIntent(input.eventType)?.audience !== "laboratory" ||
    !Object.hasOwn(copy, input.eventType)
  )
    throw new Error("INVALID_LABORATORY_EMAIL_EVENT");
  let url: URL;
  try {
    url = new URL(input.origin);
  } catch {
    throw new Error("INVALID_LABORATORY_EMAIL_ORIGIN");
  }
  if (
    url.protocol !== "https:" ||
    url.origin !== input.origin ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("INVALID_LABORATORY_EMAIL_ORIGIN");
  const [subject, instruction] = copy[input.eventType as keyof typeof copy];
  return {
    subject,
    text: `${instruction}\n\nPër hollësitë, hyni në portalin privat: ${url.origin}/\nKjo lidhje kërkon hyrje dhe lejet aktuale. Mos iu përgjigjni këtij e-maili me të dhëna të pacientit.`,
  };
}
