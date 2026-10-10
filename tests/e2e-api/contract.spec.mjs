import { test, expect } from "@playwright/test";
import { contractVersion } from "@dental-lab/contracts";
import { startProbe } from "../support/contract-probe.mjs";
test("API transport example: isolated HTTP client, valid and refused request", async ({
  request,
}) => {
  const probe = await startProbe();
  try {
    const accepted = await request.post(probe.url + "/test-contract", {
      data: { version: contractVersion },
    });
    expect(accepted.status()).toBe(200);
    expect(await accepted.json()).toEqual({ version: contractVersion });
    const refused = await request.post(probe.url + "/test-contract", {
      data: { version: 999 },
    });
    expect(refused.status()).toBe(400);
    expect(await refused.json()).toEqual({ code: "INVALID_TEST_CONTRACT" });
  } finally {
    await probe.close();
  }
});
