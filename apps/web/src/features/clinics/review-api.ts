import {
  ClinicReviewQueueSchema,
  ClinicDirectorySchema,
  ClinicIdSchema,
  ClinicReviewRequestSchema,
} from "@dental-lab/contracts";
import type { ClinicReviewRequest } from "@dental-lab/contracts";
export function createClinicReviewClient(transport: typeof fetch = fetch) {
  const options = {
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
  } as const;
  return {
    async directory(signal: AbortSignal, after?: string) {
      if (after !== undefined && !ClinicIdSchema.safeParse(after).success)
        return null;
      const response = await transport(
        "/api/v1/clinics/directory" +
          (after ? "?after=" + encodeURIComponent(after) : ""),
        { ...options, signal },
      );
      if (response.status !== 200) return null;
      const parsed = ClinicDirectorySchema.safeParse(await response.json());
      return parsed.success ? parsed.data : null;
    },
    async pending(signal: AbortSignal, after?: string) {
      if (after !== undefined && !ClinicIdSchema.safeParse(after).success)
        return null;
      const response = await transport(
        "/api/v1/clinics/pending" +
          (after ? "?after=" + encodeURIComponent(after) : ""),
        { ...options, signal },
      );
      if (response.status !== 200) return null;
      const parsed = ClinicReviewQueueSchema.safeParse(await response.json());
      return parsed.success ? parsed.data : null;
    },
    async decide(
      id: string,
      input: ClinicReviewRequest,
      signal: AbortSignal,
    ): Promise<"applied" | "conflict" | "denied" | "invalid" | "uncertain"> {
      if (
        !ClinicIdSchema.safeParse(id).success ||
        !ClinicReviewRequestSchema.safeParse(input).success
      )
        return "invalid";
      const response = await transport(
        "/api/v1/clinics/" + encodeURIComponent(id) + "/review",
        {
          ...options,
          signal,
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      return response.status === 204
        ? "applied"
        : response.status === 409
          ? "conflict"
          : response.status === 401 || response.status === 403
            ? "denied"
            : response.status === 400
              ? "invalid"
              : "uncertain";
    },
  };
}
