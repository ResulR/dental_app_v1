// Separate append-only port. Durable transaction storage is implemented with approved SQL later.
export {
  createAuditReadRepository,
  assertAuditReadReady,
} from "./read.repository.js";
export { createAuditReadService } from "./read.service.js";
export { registerAuditReadRoutes } from "./read.routes.js";
export type AuditAction =
  | "ORDER_SUBMITTED"
  | "ORDER_STATE_CHANGED"
  | "CLINIC_APPROVED"
  | "PERMISSIONS_CHANGED";
export type AuditIntent = {
  action: AuditAction;
  actorAccountId: string;
  objectType: "order" | "clinic" | "account";
  objectId: string;
  requestId: string;
  revision?: number;
};
export type AuditRecord = AuditIntent & {
  channel: "audit";
  occurredAt: string;
};
export type AuditAppend = (record: Readonly<AuditRecord>) => Promise<void>;
const actions = new Set([
  "ORDER_SUBMITTED",
  "ORDER_STATE_CHANGED",
  "CLINIC_APPROVED",
  "PERMISSIONS_CHANGED",
]);
const ids = /^[A-Za-z0-9_-]{1,128}$/;
export function createAuditWriter(append: AuditAppend) {
  return async (input: AuditIntent): Promise<void> => {
    if (
      !actions.has(input.action) ||
      !["order", "clinic", "account"].includes(input.objectType) ||
      !ids.test(input.actorAccountId) ||
      !ids.test(input.objectId) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        input.requestId,
      ) ||
      (input.revision !== undefined &&
        (!Number.isSafeInteger(input.revision) || input.revision < 0))
    ) {
      throw new Error("INVALID_AUDIT_RECORD");
    }
    const record: AuditRecord = {
      channel: "audit",
      occurredAt: new Date().toISOString(),
      action: input.action,
      actorAccountId: input.actorAccountId,
      objectType: input.objectType,
      objectId: input.objectId,
      requestId: input.requestId,
      ...(input.revision === undefined ? {} : { revision: input.revision }),
    };
    await append(Object.freeze(record));
  };
}
