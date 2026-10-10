import { expect, test } from "vitest";
import { ClinicSubmissionSchema, HealthSchema } from "@dental-lab/contracts";
import { createApp } from "../../apps/api/dist/app/create-app.js";
import { closeServer } from "../../apps/api/dist/app/server.js";
import { validateBody } from "../../apps/api/dist/shared/validate-body.js";
import {
  decodeProblem,
  decodeHealth,
  validateClinicSubmission,
} from "../../apps/web/src/shared/contracts.ts";
test("same schemas at web/server transport; no official submission or storage", async () => {
  const app = createApp(
    (app) => {
      app.post(
        "/test-contract-submission",
        validateBody(ClinicSubmissionSchema, HealthSchema, () => ({
          status: "ok",
        })),
      );
      app.post(
        "/test-invalid-response",
        validateBody(ClinicSubmissionSchema, HealthSchema, async () => ({
          status: "ok",
          patient: "SYNTHETIC_PRIVATE_MARKER",
        })),
      );
    },
    () => {},
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  try {
    const origin = "http://127.0.0.1:" + server.address().port;
    const valid = {
      patient: { internal_reference: "SYNTHETIC" },
      requested_delivery_date: "2026-10-20",
      material_id: "test-material",
      shade_id: "test-shade",
      teeth: [],
      file_ids: [],
    };
    expect(validateClinicSubmission(valid).success).toBe(true);
    const send = (body) =>
      fetch(origin + "/test-contract-submission", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    expect((await send(valid)).status).toBe(200);
    const badOutput = await fetch(origin + "/test-invalid-response", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(valid),
    });
    expect(badOutput.status).toBe(500);
    const safeOutput = decodeProblem(await badOutput.json());
    expect(safeOutput.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(safeOutput)).not.toContain(
      "SYNTHETIC_PRIVATE_MARKER",
    );
    const invalid = { ...valid, clinic_id: "SYNTHETIC_PRIVATE_MARKER" };
    expect(validateClinicSubmission(invalid).success).toBe(false);
    const refused = await send(invalid);
    expect(refused.status).toBe(400);
    const problem = decodeProblem(await refused.json());
    expect(problem.code).toBe("VALIDATION_FAILED");
    expect(problem.errors).toHaveLength(1);
    expect(JSON.stringify(problem)).not.toContain("SYNTHETIC_PRIVATE_MARKER");
    const health = await fetch(origin + "/health");
    expect(decodeHealth(await health.json())).toEqual({ status: "ok" });
    expect(() => decodeHealth({ status: "unknown" })).toThrow(
      "API_CONTRACT_MISMATCH",
    );
  } finally {
    await closeServer(server);
  }
});
