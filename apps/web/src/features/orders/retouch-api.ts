import {
  RetouchSubmissionSchema,
  RetouchSubmissionResultSchema,
} from "@dental-lab/contracts";
export function createRetouchClient(transport: typeof fetch = fetch) {
  return {
    async submit(raw: unknown, signal: AbortSignal) {
      const input = RetouchSubmissionSchema.parse(raw);
      const response = await transport("/api/v1/retouches", {
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
      const result = RetouchSubmissionResultSchema.parse(await response.json());
      if (signal.aborted) throw new Error("ORDER_SUBMISSION_UNCERTAIN");
      return result;
    },
  };
}
