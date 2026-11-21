import { test, expect } from "vitest";
import { webcrypto } from "node:crypto";
import { prepareVault, sealDraft, openDraft } from "../../apps/web/src/features/drafts/vault-crypto.ts";
import { parseRetouchIntent } from "../../apps/web/src/features/drafts/retouch-intent.ts";
const account = "90000000-0000-4000-8000-000000000001";
const source = "90000000-0000-4000-8000-000000000002";
const request = { idempotency_key: "90000000-0000-4000-8000-000000000003", confirmed_warnings: false, input: { source_order_id: source, expected_source_version_id: "90000000-0000-4000-8000-000000000004", expected_source_revision: 1, intervention_kind: "retouch", material_id: account, shade_id: account, description: "SYNTHETIC_PRIVATE", file_ids: [] } };
Object.defineProperty(globalThis, "isSecureContext", { value: true, configurable: true });
Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
test("retouch intent remains encrypted and bound to account and record", async () => {
  const { envelope, active } = await prepareVault(account, "synthetic long phrase");
  const value = { state: "uncertain", sourceId: source, request, reply: null };
  const sealed = await sealDraft(active, envelope, "clinic-retouch-submission", value);
  expect(JSON.stringify(sealed)).not.toContain("SYNTHETIC_PRIVATE");
  expect(JSON.stringify(sealed)).not.toContain(request.idempotency_key);
  expect(parseRetouchIntent(await openDraft(active, envelope, "clinic-retouch-submission", sealed), 1).request).toEqual(request);
  await expect(openDraft(active, envelope, "clinic-order-submission", sealed)).rejects.toThrow();
  await expect(openDraft(active, { ...envelope, accountId: source }, "clinic-retouch-submission", sealed)).rejects.toThrow();
}, 20000);
test("foreign source and counterfeit settled receipt are rejected", () => {
  expect(() => parseRetouchIntent({ state: "uncertain", sourceId: account, request, reply: null }, 1)).toThrow();
  expect(() => parseRetouchIntent({ state: "settled", sourceId: source, request, reply: {kind:"submitted"} }, 1)).toThrow();
});
