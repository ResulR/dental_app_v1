import { test, expect } from "vitest";
import { webcrypto } from "node:crypto";
import {
  prepareVault,
  sealDraft,
  openDraft,
} from "../../apps/web/src/features/drafts/vault-crypto.ts";
import { parseStoredSubmission } from "../../apps/web/src/features/drafts/submission-intent.ts";
const account = "90000000-0000-4000-8000-000000000001";
const request = {
  idempotency_key: "90000000-0000-4000-8000-000000000002",
  input: {
    patient: { internal_reference: "SYNTHETIC_PRIVATE" },
    requested_delivery_date: "2026-11-01",
    material_id: account,
    shade_id: "90000000-0000-4000-8000-000000000003",
    teeth: [],
    file_ids: [],
  },
  confirmed_warnings: false,
};
Object.defineProperty(globalThis, "isSecureContext", {
  value: true,
  configurable: true,
});
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});
test("the exact submission and idempotency key are sealed to the account and distinct record", async () => {
  const { envelope, active } = await prepareVault(
    account,
    "a synthetic long phrase",
  );
  const stored = {
    format: 1,
    state: "uncertain",
    idempotency_key: request.idempotency_key,
    request,
    reply: null,
  };
  const sealed = await sealDraft(
    active,
    envelope,
    "clinic-order-submission",
    stored,
  );
  expect(JSON.stringify(sealed)).not.toContain("SYNTHETIC_PRIVATE");
  expect(JSON.stringify(sealed)).not.toContain(request.idempotency_key);
  expect(
    parseStoredSubmission(
      await openDraft(active, envelope, "clinic-order-submission", sealed),
    ),
  ).toEqual(stored);
  await expect(
    openDraft(active, envelope, "clinic-order-form", sealed),
  ).rejects.toThrow("VAULT_DRAFT_INVALID");
  await expect(
    openDraft(
      active,
      { ...envelope, accountId: "90000000-0000-4000-8000-000000000009" },
      "clinic-order-submission",
      sealed,
    ),
  ).rejects.toThrow();
}, 20000);
test("invalid stages and counterfeit receipts are rejected", () => {
  expect(() =>
    parseStoredSubmission({
      format: 1,
      state: "settled",
      idempotency_key: request.idempotency_key,
      request,
      reply: null,
    }),
  ).toThrow("SUBMISSION_INTENT_INVALID");
  expect(() =>
    parseStoredSubmission({
      format: 1,
      state: "prepared",
      idempotency_key: request.idempotency_key,
      request,
      reply: { kind: "submitted" },
    }),
  ).toThrow("SUBMISSION_INTENT_INVALID");
  expect(() =>
    parseStoredSubmission({
      format: 1,
      state: "uncertain",
      idempotency_key: request.idempotency_key,
      request: {
        ...request,
        input: { ...request.input, file_ids: ["foreign"] },
      },
      reply: null,
    }),
  ).toThrow("SUBMISSION_INTENT_INVALID");
  expect(
    parseStoredSubmission({
      format: 1,
      state: "settled",
      idempotency_key: request.idempotency_key,
      request: null,
      reply: {
        kind: "submitted",
        persisted: true,
        order_id: account,
        number: "123",
        received_at: "2026-10-31T10:00:00.000Z",
        replayed: false,
      },
    }).reply?.number,
  ).toBe("123");
  expect(
    parseStoredSubmission({
      format: 1,
      state: "settled",
      idempotency_key: request.idempotency_key,
      request: null,
      reply: {
        kind: "submitted",
        persisted: true,
        order_id: account,
        number: "123",
        received_at: "2026-10-31T10:00:00.000Z",
        replayed: false,
      },
    }).request,
  ).toBeNull();
});
