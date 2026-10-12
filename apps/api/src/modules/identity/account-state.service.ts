import {
  hasEffectivePermission,
  isCurrentOwner,
  hasOwnerPermission,
} from "../permissions/index.js";
import type { PermissionContext } from "../permissions/index.js";
type ActorRef = { accountId: string; sessionId: string };
type Command = {
  targetAccountId: string;
  expectedRevision: number;
  operation: "suspend" | "reactivate" | "secure_clinic";
};
type Target = {
  id: string;
  profile: "owner" | "admin" | "employee" | "clinic";
  revision: number;
  lifecycle: "active" | "invited" | "suspended";
  hasCredential: boolean;
  securityLocked: boolean;
  resetRequired: boolean;
};
type Plan = {
  operation: Command["operation"];
  nextLifecycle: Target["lifecycle"];
  revokeSessions: true;
  incrementAuthEpoch: true;
  revokePendingInvitations: boolean;
  clinicSuspended?: boolean;
  securityLocked?: true;
  resetRequired?: true;
};
type Ports = {
  // Actor is from verified server session, not client identity/context fields.
  loadCurrent: (
    actor: ActorRef,
    targetAccountId: string,
  ) => Promise<{ actor: PermissionContext; target: Target } | null>;
  // Recheck session/epoch/current grant or owner_slot, target profile/revision,
  // lifecycle/credentials/flags under locks. Account+clinic flags/revisions,
  // session/active invitation revocation, epoch, audit/outbox are one transaction.
  // Preserve review state, existing security flags, all work/history and vault data.
  // Event streams must recheck state at each delivery; revoke after commit.
  applyAtomic: (
    actor: ActorRef,
    input: Command & { plan: Plan },
  ) => Promise<"applied" | "stale" | "denied">;
};
export function createAccountStateService(ports: Ports) {
  return {
    async change(
      actor: ActorRef,
      command: Command,
    ): Promise<
      | {
          kind: "applied";
          recoveryRequired: boolean;
          invitationRequired: boolean;
        }
      | { kind: "invalid" | "denied" | "conflict" | "recovery_required" }
    > {
      if (
        !command.targetAccountId ||
        !Number.isSafeInteger(command.expectedRevision) ||
        command.expectedRevision < 1 ||
        !["suspend", "reactivate", "secure_clinic"].includes(
          command.operation,
        ) ||
        Object.keys(command).some(
          (key) =>
            !["targetAccountId", "expectedRevision", "operation"].includes(key),
        )
      )
        return { kind: "invalid" };
      command = Object.freeze({ ...command });
      const current = await ports.loadCurrent(actor, command.targetAccountId);
      if (
        !current ||
        current.target.id !== command.targetAccountId ||
        !["clinic", "employee"].includes(current.target.profile)
      )
        return { kind: "denied" }; // Admin lifecycle is handled by owner-only 7.9.
      const target = current.target;
      const owner = isCurrentOwner(current.actor);
      if (command.operation === "secure_clinic") {
        if (
          !hasOwnerPermission(current.actor, "clinics.secure") ||
          target.profile !== "clinic"
        )
          return { kind: "denied" };
      } else if (
        !owner &&
        !hasEffectivePermission(
          current.actor,
          target.profile === "clinic" ? "clinics.manage" : "employees.suspend",
        )
      )
        return { kind: "denied" };
      if (target.revision !== command.expectedRevision)
        return { kind: "conflict" };
      // Ordinary reactivation is never a recovery bypass for a security-locked account.
      if (command.operation === "reactivate" && target.securityLocked)
        return { kind: "recovery_required" };
      if (
        command.operation === "reactivate" &&
        target.profile === "clinic" &&
        !target.hasCredential
      )
        return { kind: "conflict" };
      const nextLifecycle =
        command.operation === "suspend"
          ? "suspended"
          : command.operation === "reactivate"
            ? target.hasCredential
              ? "active"
              : "invited"
            : target.lifecycle;
      const plan: Plan = {
        operation: command.operation,
        nextLifecycle,
        revokeSessions: true,
        incrementAuthEpoch: true,
        revokePendingInvitations: command.operation !== "reactivate",
        ...(target.profile === "clinic" && command.operation !== "secure_clinic"
          ? { clinicSuspended: command.operation === "suspend" }
          : {}),
        ...(command.operation === "secure_clinic"
          ? { securityLocked: true, resetRequired: true }
          : {}),
      };
      const result = await ports.applyAtomic(actor, { ...command, plan });
      if (result !== "applied")
        return { kind: result === "stale" ? "conflict" : "denied" };
      return {
        kind: "applied",
        recoveryRequired:
          command.operation === "secure_clinic" || target.resetRequired,
        invitationRequired:
          command.operation === "reactivate" && nextLifecycle === "invited",
      };
    },
  };
}
