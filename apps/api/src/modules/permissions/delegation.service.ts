import {
  effectiveGrantCodes,
  grantableCode,
  hasEffectivePermission,
  isCurrentOwner,
  validateGrantSet,
} from "./permissions.js";
import type { PermissionCode, PermissionContext } from "./permissions.js";
type Plan =
  | {
      kind: "ready";
      permissions: readonly PermissionCode[];
      dropped: readonly PermissionCode[];
    }
  | { kind: "denied" | "invalid" };
function codeSet(input: unknown): input is PermissionCode[] {
  return (
    Array.isArray(input) &&
    input.length <= 29 &&
    input.every((code) => grantableCode("employee", code)) &&
    new Set(input).size === input.length
  );
}
export function planEmployeeGrantChange(
  actor: PermissionContext,
  envelope: unknown,
  current: unknown,
  desired: unknown,
): Plan {
  const owner = isCurrentOwner(actor);
  if (
    !owner &&
    (actor.profile !== "admin" ||
      !hasEffectivePermission(actor, "employees.manage_permissions"))
  )
    return { kind: "denied" };
  if (
    !codeSet(current) ||
    !validateGrantSet(current, "employee") ||
    !codeSet(desired)
  )
    return { kind: "invalid" };
  if (!owner && !codeSet(envelope)) return { kind: "denied" };
  const proposed = effectiveGrantCodes(desired, "employee");
  const dropped = desired.filter((code) => !proposed.includes(code));
  // A newly requested grant with missing prerequisites is never silently accepted.
  if (dropped.some((code) => !current.includes(code)))
    return { kind: "invalid" };
  const changed = [
    ...current.filter((code) => !proposed.includes(code)),
    ...proposed.filter((code) => !current.includes(code)),
  ];
  // Only actual changes must be delegated; preserve unchanged owner-assigned grants.
  if (
    !owner &&
    changed.some((code) => !(envelope as PermissionCode[]).includes(code))
  )
    return { kind: "denied" };
  return {
    kind: "ready",
    permissions: proposed,
    dropped: Object.freeze(dropped),
  };
}
type ActorRef = { accountId: string; sessionId: string };
type Command = {
  targetAccountId: string;
  expectedRevision: number;
  permissionCodes: readonly string[];
  confirmedDroppedCodes?: readonly string[];
};
type Ports = {
  // ActorRef is from verified server session, never from request body. Revalidate
  // current session/epoch/account/grants/owner slot before exposing target context.
  loadCurrent: (
    actor: ActorRef,
    targetAccountId: string,
  ) => Promise<{
    actor: PermissionContext;
    envelope: readonly string[];
    target: {
      id: string;
      profile: string;
      revision: number;
      grants: readonly string[];
    };
  } | null>;
  // Recompute authority/current envelope + exact diff/dependencies/confirmation under
  // actor+target locks in same transaction as grants replacement, epoch/revocation/audit.
  // Only employee target. A concurrent delegation revocation must deny, never succeed.
  applyAtomic: (
    actor: ActorRef,
    input: Command & { proposedPermissionCodes: readonly PermissionCode[] },
  ) => Promise<"applied" | "stale" | "denied">;
};
export function createEmployeeDelegationService(ports: Ports) {
  return {
    async change(
      actor: ActorRef,
      command: Command,
    ): Promise<
      | { kind: "applied" | "conflict" | "denied" | "invalid" }
      | {
          kind: "confirmation_required";
          droppedCodes: readonly PermissionCode[];
        }
    > {
      if (
        !command.targetAccountId ||
        !Number.isSafeInteger(command.expectedRevision) ||
        command.expectedRevision < 1 ||
        !codeSet(command.permissionCodes) ||
        (command.confirmedDroppedCodes !== undefined &&
          !codeSet(command.confirmedDroppedCodes)) ||
        Object.keys(command).some(
          (key) =>
            ![
              "targetAccountId",
              "expectedRevision",
              "permissionCodes",
              "confirmedDroppedCodes",
            ].includes(key),
        )
      )
        return { kind: "invalid" };
      command = Object.freeze({
        ...command,
        permissionCodes: Object.freeze([...command.permissionCodes]),
        ...(command.confirmedDroppedCodes
          ? {
              confirmedDroppedCodes: Object.freeze([
                ...command.confirmedDroppedCodes,
              ]),
            }
          : {}),
      });
      const current = await ports.loadCurrent(actor, command.targetAccountId);
      if (
        !current ||
        current.target.id !== command.targetAccountId ||
        current.target.profile !== "employee"
      )
        return { kind: "denied" };
      const plan = planEmployeeGrantChange(
        current.actor,
        current.envelope,
        current.target.grants,
        command.permissionCodes,
      );
      if (plan.kind !== "ready") return plan;
      if (current.target.revision !== command.expectedRevision)
        return { kind: "conflict" };
      const confirmed = command.confirmedDroppedCodes ?? [];
      if (
        confirmed.length !== plan.dropped.length ||
        plan.dropped.some((code) => !confirmed.includes(code))
      )
        return { kind: "confirmation_required", droppedCodes: plan.dropped };
      const result = await ports.applyAtomic(actor, {
        ...command,
        proposedPermissionCodes: plan.permissions,
      });
      return { kind: result === "stale" ? "conflict" : result };
    },
  };
}
