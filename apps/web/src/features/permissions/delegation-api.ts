import {
  ClinicIdSchema,
  DelegationCommandSchema,
  DelegationListSchema,
  DelegationProfileSchema,
  DelegationHistorySchema,
  DelegationResultSchema,
} from "@dental-lab/contracts";
import type { DelegationKind, DelegationCommand } from "@dental-lab/contracts";
export function createDelegationClient(transport: typeof fetch = fetch) {
  const options = {
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
  } as const;
  function path(kind: DelegationKind, id?: string) {
    if (
      !["employee", "envelope"].includes(kind) ||
      (id !== undefined && !ClinicIdSchema.safeParse(id).success)
    )
      throw new Error("INVALID_DELEGATION_PATH");
    return "/api/v1/delegation/" + kind + (id ? "/" + id : "");
  }
  async function read(url: string, signal: AbortSignal) {
    const response = await transport(url, { ...options, signal });
    if (response.status !== 200) throw new Error("DELEGATION_READ_UNAVAILABLE");
    const payload = await response.json();
    if (signal.aborted) throw new Error("DELEGATION_READ_ABORTED");
    return payload;
  }
  return {
    list: async (kind: DelegationKind, signal: AbortSignal, after?: string) => {
      if (after !== undefined && !ClinicIdSchema.safeParse(after).success)
        throw new Error("INVALID_CURSOR");
      return DelegationListSchema.parse(
        await read(
          path(kind) + (after ? "?after=" + encodeURIComponent(after) : ""),
          signal,
        ),
      );
    },
    profile: async (kind: DelegationKind, id: string, signal: AbortSignal) =>
      DelegationProfileSchema.parse(await read(path(kind, id), signal)),
    history: async (
      kind: DelegationKind,
      id: string,
      signal: AbortSignal,
      before?: number,
    ) => {
      if (before !== undefined && (!Number.isSafeInteger(before) || before < 1))
        throw new Error("INVALID_CURSOR");
      return DelegationHistorySchema.parse(
        await read(
          path(kind, id) +
            "/history" +
            (before === undefined ? "" : "?before=" + before),
          signal,
        ),
      );
    },
    async change(
      kind: DelegationKind,
      id: string,
      input: DelegationCommand,
      signal: AbortSignal,
    ) {
      const body = DelegationCommandSchema.parse(input);
      const response = await transport(path(kind, id), {
        ...options,
        signal,
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (![200, 400, 403, 409].includes(response.status))
        throw new Error("DELEGATION_WRITE_UNCERTAIN");
      const result = DelegationResultSchema.parse(await response.json());
      if (signal.aborted) throw new Error("DELEGATION_WRITE_UNCERTAIN");
      const expected =
        result.kind === "applied" || result.kind === "confirmation_required"
          ? 200
          : result.kind === "conflict"
            ? 409
            : result.kind === "denied"
              ? 403
              : 400;
      if (
        response.status !== expected ||
        (result.kind === "confirmation_required" && !result.dropped_codes)
      )
        throw new Error("DELEGATION_WRITE_UNCERTAIN");
      return result;
    },
  };
}
