import { privateOrderFragment } from "@dental-lab/contracts";
import { businessMailIntent } from "./business-event-policy.js";

// Transient, generic copy for the eight clinical events already represented by
// an outbox intent. No patient, order number, reason, address or attachment
// enters this renderer. An authorized sender must still resolve the current
// recipient and business state before any transport.
const copy = {
  order_accepted: [
    "Porosia u pranua",
    "Porosia juaj është pranuar nga laboratori.",
  ],
  correction_requested: [
    "Kërkohet korrigjim",
    "Laboratori ka kërkuar korrigjim të porosisë.",
  ],
  order_rejected: ["Porosia u refuzua", "Laboratori e ka refuzuar porosinë."],
  order_completed: ["Puna u përfundua", "Puna për porosinë ka përfunduar."],
  request_decided: [
    "Vendim për kërkesën",
    "Laboratori ka marrë vendim për kërkesën tuaj.",
  ],
  order_cancelled: ["Porosia u anulua", "Laboratori e ka anuluar porosinë."],
  instructions_changed: [
    "U ndryshuan udhëzimet",
    "Laboratori ka ndryshuar udhëzimet e porosisë.",
  ],
  laboratory_order_created: [
    "Porosi e re nga laboratori",
    "Laboratori ka krijuar një porosi për klinikën tuaj.",
  ],
} as const;
export function clinicalBusinessEmail(input: {
  eventType: string;
  origin: string;
  orderId?: string;
}): { subject: string; text: string } {
  if (
    businessMailIntent(input.eventType)?.audience !== "clinic" ||
    !Object.hasOwn(copy, input.eventType)
  )
    throw new Error("INVALID_CLINICAL_EMAIL_EVENT");
  let url: URL;
  try {
    url = new URL(input.origin);
  } catch {
    throw new Error("INVALID_CLINICAL_EMAIL_ORIGIN");
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
    throw new Error("INVALID_CLINICAL_EMAIL_ORIGIN");
  const fragment =
    input.orderId === undefined ? "" : privateOrderFragment(input.orderId);
  const [subject, instruction] = copy[input.eventType as keyof typeof copy];
  return {
    subject,
    text: `${instruction}\n\nPër hollësitë, hyni në portalin privat: ${url.origin}/${fragment}\nKjo lidhje kërkon hyrje dhe lejet aktuale. Mos iu përgjigjni këtij e-maili me të dhëna të pacientit.`,
  };
}
