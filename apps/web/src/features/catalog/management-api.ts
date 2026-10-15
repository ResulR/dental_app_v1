import {
  ClinicIdSchema,
  CatalogCreateSchema,
  CatalogEditSchema,
  CatalogManagedPageSchema,
  CatalogManagedProfileSchema,
  CatalogHistorySchema,
  CatalogImpactsSchema,
  CatalogMutationResultSchema,
} from "@dental-lab/contracts";
export function createCatalogManagementClient(transport: typeof fetch = fetch) {
  const options = {
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
  } as const;
  function path(id: string) {
    if (!ClinicIdSchema.safeParse(id).success)
      throw new Error("INVALID_ACCOUNT_ID");
    return "/api/v1/catalog-management/" + id;
  }
  async function read(url: string, signal: AbortSignal) {
    const response = await transport(url, { ...options, signal });
    if (response.status !== 200) throw new Error("ACCOUNT_STATE_UNAVAILABLE");
    const result = await response.json();
    if (signal.aborted) throw new Error("ABORTED");
    return result;
  }
  return {
    async create(input: unknown, signal: AbortSignal) {
      const body = CatalogCreateSchema.parse(input),
        response = await transport("/api/v1/catalog-management", {
          ...options,
          signal,
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      if (![201, 400, 403].includes(response.status))
        throw new Error("CATALOG_CREATE_UNCERTAIN");
      const result = CatalogMutationResultSchema.parse(await response.json());
      if (
        signal.aborted ||
        response.status !==
          (result.kind === "applied"
            ? 201
            : result.kind === "denied"
              ? 403
              : 400)
      )
        throw new Error("CATALOG_CREATE_UNCERTAIN");
      return result;
    },
    async list(signal: AbortSignal, after?: string) {
      if (after !== undefined && !ClinicIdSchema.safeParse(after).success)
        throw new Error("INVALID_ACCOUNT_CURSOR");
      return CatalogManagedPageSchema.parse(
        await read(
          "/api/v1/catalog-management" + (after ? "?after=" + after : ""),
          signal,
        ),
      );
    },
    profile: async (id: string, signal: AbortSignal) =>
      CatalogManagedProfileSchema.parse(await read(path(id), signal)),
    async impacts(id: string, signal: AbortSignal, after?: string) {
      if (after !== undefined && !ClinicIdSchema.safeParse(after).success)
        throw new Error("INVALID_CATALOG_CURSOR");
      return CatalogImpactsSchema.parse(
        await read(
          path(id) + "/impacts" + (after ? "?after=" + after : ""),
          signal,
        ),
      );
    },
    async history(id: string, signal: AbortSignal, before?: number) {
      if (before !== undefined && (!Number.isSafeInteger(before) || before < 1))
        throw new Error("INVALID_HISTORY_CURSOR");
      return CatalogHistorySchema.parse(
        await read(
          path(id) +
            "/history" +
            (before === undefined ? "" : "?before=" + before),
          signal,
        ),
      );
    },
    async change(id: string, input: unknown, signal: AbortSignal) {
      const body = CatalogEditSchema.parse(input);
      const response = await transport(path(id), {
        ...options,
        signal,
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (![200, 400, 403, 409].includes(response.status))
        throw new Error("ACCOUNT_STATE_WRITE_UNCERTAIN");
      const result = CatalogMutationResultSchema.parse(await response.json());
      const expected =
        result.kind === "applied"
          ? 200
          : result.kind === "denied"
            ? 403
            : result.kind === "invalid"
              ? 400
              : 409;
      if (signal.aborted || expected !== response.status)
        throw new Error("ACCOUNT_STATE_WRITE_UNCERTAIN");
      return result;
    },
  };
}
