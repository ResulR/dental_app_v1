import {
  ClinicProfileSchema,
  ClinicContactHistorySchema,
  ClinicContactUpdateSchema,
  ClinicIdSchema,
} from "@dental-lab/contracts";
import type { ClinicProfile, ClinicContactUpdate } from "@dental-lab/contracts";
export function createClinicProfileClient(transport: typeof fetch = fetch) {
  return {
    async save(
      id: string,
      input: ClinicContactUpdate,
      signal: AbortSignal,
    ): Promise<{ kind: "applied" | "conflict" | "denied" | "invalid" }> {
      if (
        !ClinicIdSchema.safeParse(id).success ||
        !ClinicContactUpdateSchema.safeParse(input).success
      )
        return { kind: "invalid" };
      const response = await transport("/api/v1/clinics/" + id + "/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        signal,
      });
      if (response.status === 204) return { kind: "applied" };
      if (response.status === 409) return { kind: "conflict" };
      if (response.status === 401 || response.status === 403)
        return { kind: "denied" };
      if (response.status === 400) return { kind: "invalid" };
      throw new Error("PROFILE_SAVE_UNCERTAIN");
    },
    async history(id: string, signal: AbortSignal, before?: number) {
      if (!ClinicIdSchema.safeParse(id).success) return null;
      const response = await transport(
        "/api/v1/clinics/" +
          id +
          "/profile/history" +
          (before === undefined ? "" : "?before=" + before),
        {
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          signal,
        },
      );
      if (response.status !== 200) return null;
      const parsed = ClinicContactHistorySchema.safeParse(
        await response.json(),
      );
      return parsed.success ? parsed.data : null;
    },
    async own(signal: AbortSignal, id?: string): Promise<ClinicProfile | null> {
      if (id !== undefined && !ClinicIdSchema.safeParse(id).success)
        return null;
      const response = await transport(
        "/api/v1/clinics/" + (id ?? "self") + "/profile",
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          signal,
        },
      );
      if (response.status !== 200) return null;
      const parsed = ClinicProfileSchema.safeParse(await response.json());
      return parsed.success ? parsed.data : null;
    },
  };
}
