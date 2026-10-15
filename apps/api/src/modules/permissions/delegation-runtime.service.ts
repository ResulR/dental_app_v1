import { createDelegationRepository } from "./delegation.repository.js";
import { createEmployeeDelegationService } from "./delegation.service.js";
import { DelegationCommandSchema } from "@dental-lab/contracts";
import type { DelegationKind } from "@dental-lab/contracts";
export function createDelegationRuntimeService(
  database: Parameters<typeof createDelegationRepository>[0],
) {
  const store = createDelegationRepository(database),
    service = createEmployeeDelegationService(store);
  return {
    list: store.list,
    profile: store.profile,
    history: store.history,
    async change(
      actor: { accountId: string; sessionId: string },
      kind: DelegationKind,
      targetId: string,
      input: unknown,
    ) {
      const parsed = DelegationCommandSchema.safeParse(input);
      if (!parsed.success) return { kind: "invalid" as const };
      const command = parsed.data;
      if (kind === "envelope") {
        const result = await store.applyEnvelope(actor, targetId, command);
        return { kind: result === "stale" ? ("conflict" as const) : result };
      }
      const result = await service.change(actor, {
        targetAccountId: targetId,
        expectedRevision: command.expected_revision,
        permissionCodes: command.permission_codes,
        ...(command.confirmed_dropped_codes
          ? { confirmedDroppedCodes: command.confirmed_dropped_codes }
          : {}),
      });
      return result.kind === "confirmation_required"
        ? { kind: result.kind, dropped_codes: result.droppedCodes }
        : result;
    },
  };
}
