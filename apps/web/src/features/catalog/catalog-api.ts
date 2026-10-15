import {
  ActiveCatalogPageSchema,
  CatalogKindSchema,
  ClinicIdSchema,
} from "@dental-lab/contracts";
export function createCatalogClient(transport: typeof fetch = fetch) {
  return {
    async list(kind: unknown, signal: AbortSignal, after?: string) {
      const parsed = CatalogKindSchema.parse(kind);
      if (after !== undefined) ClinicIdSchema.parse(after);
      const response = await transport(
        "/api/v1/catalog/" + parsed + (after ? "?after=" + after : ""),
        {
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          signal,
        },
      );
      if (response.status !== 200) throw new Error("CATALOG_UNAVAILABLE");
      const result = ActiveCatalogPageSchema.parse(await response.json());
      if (signal.aborted || result.items.some((item) => item.kind !== parsed))
        throw new Error("CATALOG_UNAVAILABLE");
      return result;
    },
  };
}
