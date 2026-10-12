import { hasOwnerPermission, isOwnerPermission } from "../permissions/index.js";
import type { PermissionContext } from "../permissions/index.js";

// References come only from authenticated server session middleware, never a DTO.
export type OwnerActorRef = Readonly<{ accountId: string; sessionId: string }>;
type Ports = {
  loadCurrent: (actor: OwnerActorRef) => Promise<PermissionContext | null>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createOwnerAccessService(ports: Ports) {
  return {
    async authorize(actor: OwnerActorRef, action: unknown): Promise<boolean> {
      if (
        !isOwnerPermission(action) ||
        typeof actor.accountId !== "string" ||
        typeof actor.sessionId !== "string" ||
        !uuid.test(actor.accountId) ||
        !uuid.test(actor.sessionId)
      )
        return false;
      const reference = Object.freeze({
        accountId: actor.accountId,
        sessionId: actor.sessionId,
      });
      const context = await ports.loadCurrent(reference);
      return context !== null && hasOwnerPermission(context, action);
    },
  };
}
