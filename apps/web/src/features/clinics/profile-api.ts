import { ClinicProfileSchema } from "@dental-lab/contracts";
import type { ClinicProfile } from "@dental-lab/contracts";
export function createClinicProfileClient(transport: typeof fetch = fetch) {
  return {
    async own(signal: AbortSignal): Promise<ClinicProfile | null> {
      const response = await transport("/api/v1/clinics/self/profile", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        signal,
      });
      if (response.status !== 200) return null;
      const parsed = ClinicProfileSchema.safeParse(await response.json());
      return parsed.success ? parsed.data : null;
    },
  };
}
