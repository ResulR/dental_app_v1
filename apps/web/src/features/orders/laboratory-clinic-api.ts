import {
  LaboratoryClinicOrderSchema,
  LaboratoryClinicOrderResultSchema,
  LaboratoryClinicListQuerySchema,
  LaboratoryClinicListSchema,
} from "@dental-lab/contracts";
export function createLaboratoryClinicClient(transport: typeof fetch = fetch) {
  return {
    async clinics(after: string | undefined, signal: AbortSignal) {
      const query = LaboratoryClinicListQuerySchema.parse(
        after ? { after } : {},
      );
      const response = await transport(
        "/api/v1/orders/laboratory-clinics" +
          (query.after ? `?after=${encodeURIComponent(query.after)}` : ""),
        {
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          signal,
        },
      );
      if (response.status !== 200) throw new Error("CLINICS_UNAVAILABLE");
      const page = LaboratoryClinicListSchema.parse(await response.json());
      if (signal.aborted) throw new Error("CLINICS_UNAVAILABLE");
      return page;
    },
    async submit(raw: unknown, signal: AbortSignal) {
      const input = LaboratoryClinicOrderSchema.parse(raw);
      const response = await transport("/api/v1/orders/laboratory-clinic", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal,
      });
      if (response.status !== 200)
        throw new Error("ORDER_SUBMISSION_UNCERTAIN");
      const result = LaboratoryClinicOrderResultSchema.parse(
        await response.json(),
      );
      if (signal.aborted) throw new Error("ORDER_SUBMISSION_UNCERTAIN");
      return result;
    },
  };
}
