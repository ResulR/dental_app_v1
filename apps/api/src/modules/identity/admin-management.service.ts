import { validateGrantSet } from "../permissions/index.js";
type Actor = {
  accountId: string;
  profile: "owner" | "admin" | "employee" | "clinic";
};
type Command = { targetAccountId: string; expectedRevision: number } & (
  | { operation: "suspend" | "reactivate" }
  | { operation: "permissions"; permissionCodes: readonly string[] }
);
type Ports = {
  authorizeOwner: (actor: Actor) => Promise<boolean>;
  readTarget: (
    accountId: string,
  ) => Promise<{ id: string; profile: Actor["profile"] } | null>;
  // Validate against current registry/dependencies; no implicit rights/delegation.
  validatePermissions: (codes: readonly string[]) => Promise<boolean>;
  // Same transaction: recheck owner_slot/current active actor, target profile admin,
  // expected revision/current lifecycle and permission registry/dependencies.
  // Suspension/rights changes bump epoch/revoke sessions + audit. Reactivation
  // preserves security flags; do not activate an account lacking a credential.
  // Never mutate owner_slot, profile, credentials or another type of account.
  mutateAtomic: (
    actor: Actor,
    command: Command,
  ) => Promise<"applied" | "stale" | "denied">;
};
export function createAdminManagementService(ports: Ports) {
  return {
    async manage(
      actor: Actor,
      command: Command,
    ): Promise<{ kind: "applied" | "conflict" | "denied" | "invalid" }> {
      if (
        actor.profile !== "owner" ||
        actor.accountId === command.targetAccountId
      )
        return { kind: "denied" };
      if (
        !command.targetAccountId ||
        !Number.isSafeInteger(command.expectedRevision) ||
        command.expectedRevision < 1 ||
        !["suspend", "reactivate", "permissions"].includes(command.operation)
      )
        return { kind: "invalid" };
      const allowed = new Set([
        "targetAccountId",
        "expectedRevision",
        "operation",
        ...(command.operation === "permissions" ? ["permissionCodes"] : []),
      ]);
      if (Object.keys(command).some((key) => !allowed.has(key)))
        return { kind: "invalid" };
      if (
        command.operation === "permissions" &&
        !Array.isArray(command.permissionCodes)
      )
        return { kind: "invalid" };
      command =
        command.operation === "permissions"
          ? Object.freeze({
              ...command,
              permissionCodes: Object.freeze([...command.permissionCodes]),
            })
          : Object.freeze({ ...command });
      if (!(await ports.authorizeOwner(actor))) return { kind: "denied" };
      const target = await ports.readTarget(command.targetAccountId);
      if (
        !target ||
        target.id !== command.targetAccountId ||
        target.profile !== "admin"
      )
        return { kind: "denied" };
      if (command.operation === "permissions") {
        const codes = command.permissionCodes;
        if (
          !Array.isArray(codes) ||
          codes.length > 29 ||
          codes.some((code) => typeof code !== "string" || code.length > 64) ||
          new Set(codes).size !== codes.length ||
          !validateGrantSet(codes, "admin") ||
          !(await ports.validatePermissions(codes))
        )
          return { kind: "invalid" };
      }
      const result = await ports.mutateAtomic(actor, command);
      return { kind: result === "stale" ? "conflict" : result };
    },
  };
}
