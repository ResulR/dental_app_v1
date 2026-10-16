import {
  LaboratoryProfileSchema,
  LaboratoryHistorySchema,
  LaboratoryUpdateSchema,
  LaboratoryMutationResultSchema,
} from "@dental-lab/contracts";
export function createLaboratorySettingsClient(
  transport: typeof fetch = fetch,
) {
  const url = "/api/v1/laboratory-settings";
  const options = {
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
  } as const;
  async function read(path: string, signal: AbortSignal) {
    const response = await transport(path, { ...options, signal });
    if (response.status !== 200) throw new Error("SETTINGS_UNAVAILABLE");
    const result = await response.json();
    if (signal.aborted) throw new Error("ABORTED");
    return result;
  }
  return {
    read: async (signal: AbortSignal) =>
      LaboratoryProfileSchema.parse(await read(url, signal)),
    async history(signal: AbortSignal, before?: number) {
      if (before !== undefined && (!Number.isSafeInteger(before) || before < 1))
        throw new Error("INVALID_SETTINGS_CURSOR");
      return LaboratoryHistorySchema.parse(
        await read(
          url + "/history" + (before === undefined ? "" : "?before=" + before),
          signal,
        ),
      );
    },
    async update(raw: unknown, signal: AbortSignal) {
      const body = LaboratoryUpdateSchema.parse(raw);
      const response = await transport(url, {
        ...options,
        signal,
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (![200, 400, 403, 409].includes(response.status))
        throw new Error("SETTINGS_WRITE_UNCERTAIN");
      const result = LaboratoryMutationResultSchema.parse(
        await response.json(),
      );
      const expected =
        result.kind === "applied"
          ? 200
          : result.kind === "denied"
            ? 403
            : result.kind === "invalid"
              ? 400
              : 409;
      if (signal.aborted || response.status !== expected)
        throw new Error("SETTINGS_WRITE_UNCERTAIN");
      return result;
    },
  };
}
