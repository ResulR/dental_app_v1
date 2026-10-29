const FORMAT = 1;
const ITERATIONS = 600_000;
const bytes = (value: ArrayBuffer | Uint8Array) => new Uint8Array(value);
const encode = (value: ArrayBuffer | Uint8Array) => {
  const source = bytes(value);
  const chunks: string[] = [];
  for (let index = 0; index < source.length; index += 16_384)
    chunks.push(String.fromCharCode(...source.subarray(index, index + 16_384)));
  return btoa(chunks.join(""))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
};
const decode = (value: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("VAULT_INVALID_CODE");
  const raw = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const aad = (
  accountId: string,
  vaultId: string,
  draftId: string,
  generation: string,
) =>
  new TextEncoder().encode(
    JSON.stringify([FORMAT, accountId, vaultId, draftId, generation]),
  );
const random = (size: number) => crypto.getRandomValues(new Uint8Array(size));
function supported() {
  if (!globalThis.isSecureContext || !globalThis.crypto?.subtle)
    throw new Error("VAULT_CRYPTO_UNAVAILABLE");
}
async function phraseKey(phrase: string, salt: Uint8Array) {
  if (phrase.length < 12) throw new Error("VAULT_PHRASE_TOO_SHORT");
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(phrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: bytes(salt),
      iterations: ITERATIONS,
    },
    material,
    { name: "AES-KW", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}
async function recoveryKey(code: Uint8Array) {
  if (code.length !== 32) throw new Error("VAULT_INVALID_CODE");
  return crypto.subtle.importKey("raw", bytes(code), "AES-KW", false, [
    "wrapKey",
    "unwrapKey",
  ]);
}
export type VaultEnvelope = {
  format: 1;
  accountId: string;
  vaultId: string;
  salt: string;
  iterations: 600000;
  wrappedPhrase: string;
  wrappedRecovery: string;
};
export type SealedDraft = {
  generation: string;
  iv: string;
  ciphertext: string;
  wrappedKey: string;
};
function validEnvelope(value: VaultEnvelope, accountId: string) {
  if (
    value.format !== FORMAT ||
    value.accountId !== accountId ||
    value.iterations !== ITERATIONS ||
    !/^[0-9a-f-]{36}$/.test(value.vaultId) ||
    decode(value.salt).length !== 16 ||
    !decode(value.wrappedPhrase).length ||
    !decode(value.wrappedRecovery).length
  )
    throw new Error("VAULT_ENVELOPE_INVALID");
}
export async function prepareVault(accountId: string, phrase: string) {
  supported();
  if (!accountId || !phrase) throw new Error("VAULT_IDENTITY_REQUIRED");
  const root = await crypto.subtle.generateKey(
    { name: "AES-KW", length: 256 },
    true,
    ["wrapKey", "unwrapKey"],
  );
  const salt = random(16);
  const code = random(32);
  const envelope: VaultEnvelope = {
    format: 1,
    accountId,
    vaultId: crypto.randomUUID(),
    salt: encode(salt),
    iterations: ITERATIONS,
    wrappedPhrase: encode(
      await crypto.subtle.wrapKey(
        "raw",
        root,
        await phraseKey(phrase, salt),
        "AES-KW",
      ),
    ),
    wrappedRecovery: encode(
      await crypto.subtle.wrapKey(
        "raw",
        root,
        await recoveryKey(code),
        "AES-KW",
      ),
    ),
  };
  const recoveryCode = encode(code);
  code.fill(0);
  // Reimport the active key without export permission.
  const active = await crypto.subtle.unwrapKey(
    "raw",
    bytes(decode(envelope.wrappedPhrase)),
    await phraseKey(phrase, salt),
    "AES-KW",
    { name: "AES-KW", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
  const probe = await sealDraft(active, envelope, "vault-verification", {
    format: FORMAT,
  });
  if (
    (
      await openDraft<{ format: number }>(
        active,
        envelope,
        "vault-verification",
        probe,
      )
    ).format !== FORMAT
  )
    throw new Error("VAULT_CRYPTO_UNAVAILABLE");
  return { envelope, recoveryCode, active };
}
export async function unlockVault(
  envelope: VaultEnvelope,
  accountId: string,
  secret: string,
  method: "phrase" | "recovery",
) {
  supported();
  validEnvelope(envelope, accountId);
  const key =
    method === "phrase"
      ? await phraseKey(secret, decode(envelope.salt))
      : await recoveryKey(decode(secret));
  try {
    return await crypto.subtle.unwrapKey(
      "raw",
      bytes(
        decode(
          method === "phrase"
            ? envelope.wrappedPhrase
            : envelope.wrappedRecovery,
        ),
      ),
      key,
      "AES-KW",
      { name: "AES-KW", length: 256 },
      false,
      ["wrapKey", "unwrapKey"],
    );
  } catch {
    throw new Error("VAULT_UNLOCK_FAILED");
  }
}
export async function recoverPhrase(
  envelope: VaultEnvelope,
  accountId: string,
  code: string,
  nextPhrase: string,
) {
  supported();
  validEnvelope(envelope, accountId);
  if (!nextPhrase) throw new Error("VAULT_PHRASE_REQUIRED");
  const recovery = await recoveryKey(decode(code));
  let root: CryptoKey;
  try {
    root = await crypto.subtle.unwrapKey(
      "raw",
      bytes(decode(envelope.wrappedRecovery)),
      recovery,
      "AES-KW",
      { name: "AES-KW", length: 256 },
      true,
      ["wrapKey", "unwrapKey"],
    );
  } catch {
    throw new Error("VAULT_UNLOCK_FAILED");
  }
  const salt = random(16);
  const next: VaultEnvelope = {
    ...envelope,
    salt: encode(salt),
    wrappedPhrase: encode(
      await crypto.subtle.wrapKey(
        "raw",
        root,
        await phraseKey(nextPhrase, salt),
        "AES-KW",
      ),
    ),
  };
  await unlockVault(next, accountId, nextPhrase, "phrase");
  return next;
}
export async function sealDraft(
  key: CryptoKey,
  envelope: VaultEnvelope,
  draftId: string,
  value: unknown,
): Promise<SealedDraft> {
  supported();
  const generation = crypto.randomUUID();
  const iv = random(12);
  const objectKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const wrappedKey = encode(
    await crypto.subtle.wrapKey("raw", objectKey, key, "AES-KW"),
  );
  const activeObjectKey = await crypto.subtle.unwrapKey(
    "raw",
    bytes(decode(wrappedKey)),
    key,
    "AES-KW",
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  if (plaintext.length > 65_536) throw new Error("VAULT_DRAFT_TOO_LARGE");
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: aad(
        envelope.accountId,
        envelope.vaultId,
        draftId,
        generation,
      ),
      tagLength: 128,
    },
    activeObjectKey,
    plaintext,
  );
  plaintext.fill(0);
  return {
    generation,
    iv: encode(iv),
    ciphertext: encode(ciphertext),
    wrappedKey,
  };
}
export async function openDraft<T>(
  key: CryptoKey,
  envelope: VaultEnvelope,
  draftId: string,
  sealed: SealedDraft,
): Promise<T> {
  supported();
  validEnvelope(envelope, envelope.accountId);
  if (
    !/^[0-9a-f-]{36}$/.test(sealed.generation) ||
    decode(sealed.iv).length !== 12 ||
    sealed.ciphertext.length > 100_000 ||
    decode(sealed.wrappedKey).length !== 40
  )
    throw new Error("VAULT_DRAFT_INVALID");
  try {
    const objectKey = await crypto.subtle.unwrapKey(
      "raw",
      bytes(decode(sealed.wrappedKey)),
      key,
      "AES-KW",
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes(decode(sealed.iv)),
        additionalData: aad(
          envelope.accountId,
          envelope.vaultId,
          draftId,
          sealed.generation,
        ),
        tagLength: 128,
      },
      objectKey,
      bytes(decode(sealed.ciphertext)),
    );
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(plaintext),
    ) as T;
  } catch {
    throw new Error("VAULT_DRAFT_INVALID");
  }
}
