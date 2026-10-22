// Closed policy for business e-mail intents. No recipient, body, provider or sending here.
// A dispatcher must still recheck the current recipient and business state.
export const laboratoryMailCategories = [
  "order_submitted",
  "clinic_registered",
  "modification_requested",
  "cancellation_requested",
  "retouch_requested",
  "correction_resubmitted",
] as const;

export type LaboratoryMailCategory = (typeof laboratoryMailCategories)[number];

const clinicalMailEvents = new Set([
  "order_accepted",
  "correction_requested",
  "order_rejected",
  "order_completed",
  "request_decided",
  "order_cancelled",
  "instructions_changed",
  "laboratory_order_created",
]);
const laboratoryMailEvents = new Set<string>(laboratoryMailCategories);

export function businessMailIntent(eventType: string):
  | { audience: "laboratory"; category: LaboratoryMailCategory }
  | {
      audience: "clinic";
    }
  | null {
  if (laboratoryMailEvents.has(eventType))
    return {
      audience: "laboratory",
      category: eventType as LaboratoryMailCategory,
    };
  if (clinicalMailEvents.has(eventType)) return { audience: "clinic" };
  return null;
}
