import { afterEach, expect, test } from "vitest";
import { contractVersion } from "@dental-lab/contracts";
import { startProbe } from "../support/contract-probe.mjs";
let probe;
afterEach(async () => {
  if (probe) await probe.close();
});
test("Express transport and shared ESM contract agree; invalid payload refused", async () => {
  probe = await startProbe();
  const send = (body) =>
    fetch(probe.url + "/test-contract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const valid = await send({ version: contractVersion });
  expect(valid.status).toBe(200);
  expect(await valid.json()).toEqual({ version: contractVersion });
  for (const body of [
    { version: 999 },
    { version: contractVersion, extra: "synthetic" },
  ]) {
    const invalid = await send(body);
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ code: "INVALID_TEST_CONTRACT" });
  }
});
