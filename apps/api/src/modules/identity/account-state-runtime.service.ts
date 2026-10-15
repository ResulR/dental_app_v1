import { AccountStateCommandSchema } from "@dental-lab/contracts";
import { createAccountStateRepository } from "./account-state.repository.js";
import { createAccountStateService } from "./account-state.service.js";
export function createAccountStateRuntimeService(
  database: Parameters<typeof createAccountStateRepository>[0],
) {
  const store = createAccountStateRepository(database),
    engine = createAccountStateService(store);
  return {
    list: store.list,
    profile: store.profile,
    history: store.history,
    async change(
      actor: { accountId: string; sessionId: string },
      targetId: string,
      input: unknown,
    ) {
      const parsed = AccountStateCommandSchema.safeParse(input);
      if (!parsed.success) return { kind: "invalid" as const };
      return engine.change(actor, {
        targetAccountId: targetId,
        expectedRevision: parsed.data.expected_revision,
        operation: parsed.data.operation,
      });
    },
  };
}
