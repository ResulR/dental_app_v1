import {
  ClinicRegistrationRequestSchema,
  ClinicRegistrationReceiptSchema,
  RegistrationTermsSchema,
} from "@dental-lab/contracts";
export function createRegistrationClient(transport: typeof fetch = fetch) {
  async function request(method: string, path: string, body?: unknown) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await transport("/api/v1/clinics/registration" + path, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    async terms() {
      try {
        const response = await request("GET", "/terms");
        if (response.status !== 200) return undefined;
        const parsed = RegistrationTermsSchema.safeParse(response.body);
        return parsed.success ? parsed.data : undefined;
      } catch {
        return undefined;
      }
    },
    async register(
      body: unknown,
    ): Promise<"pending" | "invalid" | "limited" | "uncertain"> {
      const parsed = ClinicRegistrationRequestSchema.safeParse(body);
      if (!parsed.success) return "invalid";
      try {
        const response = await request("POST", "", parsed.data);
        if (
          response.status === 201 &&
          ClinicRegistrationReceiptSchema.safeParse(response.body).success
        )
          return "pending";
        if (response.status === 400) return "invalid";
        if (response.status === 429) return "limited";
        return "uncertain";
      } catch {
        return "uncertain";
      }
    },
  };
}
