import type { DeliveryLease } from "./dormant-delivery.repository.js";
import type { DeliveryOutcome } from "./delivery-retry.js";

// Synthetic harness only: no address, content, credentials or transport is
// passed to the injected adapter. Never imported by the application runtime.
export type SyntheticProvider = (lease: DeliveryLease) => Promise<{
  outcome: DeliveryOutcome | "provider_accepted";
  providerId?: string;
}>;

type Queue = {
  recoverExpired(): Promise<boolean>;
  claim(): Promise<DeliveryLease | null>;
  preflight(lease: DeliveryLease): Promise<"eligible" | "cancelled" | "lost">;
  settle(
    lease: DeliveryLease,
    outcome: DeliveryOutcome | "provider_accepted",
    providerId?: string,
  ): Promise<boolean>;
};

export async function runOneSyntheticDelivery(
  queue: Queue,
  provider: SyntheticProvider,
  timeoutMs = 5000,
) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000)
    throw new Error("SYNTHETIC_TIMEOUT_INVALID");
  // One recovered reservation per invocation; never retry its possible send.
  if (await queue.recoverExpired()) return "recovered_ambiguous" as const;
  const lease = await queue.claim();
  if (!lease) return "idle" as const;
  const decision = await queue.preflight(lease);
  if (decision !== "eligible") return decision;
  let result: Awaited<ReturnType<SyntheticProvider>>;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    result = await Promise.race([
      provider(lease),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("SYNTHETIC_TIMEOUT")),
          timeoutMs,
        );
      }),
    ]);
  } catch {
    // Includes timeouts and unknown acceptance. A rejected Promise cannot
    // prove the synthetic provider did not accept a request.
    result = { outcome: "ambiguous" };
  } finally {
    if (timer) clearTimeout(timer);
  }
  const settled = await queue.settle(lease, result.outcome, result.providerId);
  return settled ? result.outcome : ("lost" as const);
}
