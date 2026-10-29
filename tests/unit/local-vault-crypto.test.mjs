import { test, expect } from "vitest";
import { webcrypto } from "node:crypto";
import {
  prepareVault,
  unlockVault,
  recoverPhrase,
  sealDraft,
  openDraft,
} from "../../apps/web/src/features/drafts/vault-crypto.ts";
const account = "90000000-0000-4000-8000-000000000001";
Object.defineProperty(globalThis, "isSecureContext", {
  value: true,
  configurable: true,
});
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});
const fake = {
  patient: { internal_reference: "SYNTHETIC_PRIVATE" },
  description: "Fixture",
};
test("phrase and independent recovery unwrap the same encrypted draft; new phrase keeps ciphertext", async () => {
  const { envelope, recoveryCode, active } = await prepareVault(
    account,
    "a separate long synthetic phrase",
  );
  expect(JSON.stringify(envelope)).not.toContain(
    "a separate long synthetic phrase",
  );
  expect(JSON.stringify(envelope)).not.toContain(recoveryCode);
  expect(envelope.iterations).toBe(600000);
  expect(recoveryCode.length).toBe(43);
  const sealed = await sealDraft(active, envelope, "clinic-order-form", fake);
  expect(JSON.stringify(sealed)).not.toContain("SYNTHETIC_PRIVATE");
  const nextGeneration = await sealDraft(
    active,
    envelope,
    "clinic-order-form",
    fake,
  );
  expect(nextGeneration.wrappedKey).not.toBe(sealed.wrappedKey);
  expect(nextGeneration.generation).not.toBe(sealed.generation);
  expect(
    await openDraft(
      await unlockVault(
        envelope,
        account,
        "a separate long synthetic phrase",
        "phrase",
      ),
      envelope,
      "clinic-order-form",
      sealed,
    ),
  ).toEqual(fake);
  expect(
    await openDraft(
      await unlockVault(envelope, account, recoveryCode, "recovery"),
      envelope,
      "clinic-order-form",
      sealed,
    ),
  ).toEqual(fake);
  const replacement = await recoverPhrase(
    envelope,
    account,
    recoveryCode,
    "another distinct synthetic phrase",
  );
  expect(replacement.wrappedRecovery).toBe(envelope.wrappedRecovery);
  expect(
    await openDraft(
      await unlockVault(
        replacement,
        account,
        "another distinct synthetic phrase",
        "phrase",
      ),
      replacement,
      "clinic-order-form",
      sealed,
    ),
  ).toEqual(fake);
  await expect(
    unlockVault(
      replacement,
      account,
      "a separate long synthetic phrase",
      "phrase",
    ),
  ).rejects.toThrow("VAULT_UNLOCK_FAILED");
  await expect(webcrypto.subtle.exportKey("raw", active)).rejects.toThrow();
}, 20000);
test("wrong identity, wrong secrets and altered bytes fail closed", async () => {
  const { envelope, recoveryCode, active } = await prepareVault(
    account,
    "synthetic phrase",
  );
  const sealed = await sealDraft(active, envelope, "clinic-order-form", fake);
  await expect(
    unlockVault(
      envelope,
      "90000000-0000-4000-8000-000000000002",
      "synthetic phrase",
      "phrase",
    ),
  ).rejects.toThrow("VAULT_ENVELOPE_INVALID");
  await expect(
    unlockVault(envelope, account, "wrong phrase", "phrase"),
  ).rejects.toThrow("VAULT_UNLOCK_FAILED");
  await expect(
    unlockVault(
      envelope,
      account,
      (recoveryCode[0] === "A" ? "B" : "A") + recoveryCode.slice(1),
      "recovery",
    ),
  ).rejects.toThrow("VAULT_UNLOCK_FAILED");
  await expect(
    openDraft(active, envelope, "different-draft", sealed),
  ).rejects.toThrow("VAULT_DRAFT_INVALID");
  await expect(
    openDraft(active, envelope, "clinic-order-form", {
      ...sealed,
      ciphertext:
        (sealed.ciphertext[0] === "A" ? "B" : "A") + sealed.ciphertext.slice(1),
    }),
  ).rejects.toThrow("VAULT_DRAFT_INVALID");
  await expect(
    recoverPhrase(envelope, account, "invalid-code", "next phrase"),
  ).rejects.toThrow("VAULT_INVALID_CODE");
}, 20000);
