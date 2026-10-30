import { DraftMutationSchema } from "@dental-lab/contracts";
import {
  openDraft,
  sealDraft,
  type SealedDraft,
  type VaultEnvelope,
} from "./vault-crypto.js";

import type { DraftCommand } from "./draft-sync-api.js";
export type RemoteDraft = {
  draft_id: string;
  revision: string;
  pending: DraftCommand | null;
  origin_draft_id?: string;
};
const NAME = "dental-lab-local-vault-v1";
const DRAFT = "clinic-order-form";
type StoredDraft = {
  accountId: string;
  draftId: string;
  vaultId: string;
  revision: number;
  sealed: SealedDraft;
};
const storageError = (name?: string) =>
  new Error(
    name === "QuotaExceededError"
      ? "VAULT_QUOTA_EXCEEDED"
      : "VAULT_STORAGE_UNAVAILABLE",
  );
const result = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(storageError(request.error?.name));
  });
const completed = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(storageError(transaction.error?.name));
    transaction.onerror = () => reject(storageError(transaction.error?.name));
  });
export async function openLocalVault() {
  if (
    !globalThis.isSecureContext ||
    !globalThis.indexedDB ||
    !globalThis.crypto?.subtle
  )
    throw new Error("VAULT_STORAGE_UNAVAILABLE");
  const request = indexedDB.open(NAME, 1);
  request.onupgradeneeded = () => {
    const database = request.result;
    database.createObjectStore("vaults", { keyPath: "accountId" });
    database.createObjectStore("drafts", { keyPath: ["accountId", "draftId"] });
  };
  request.onblocked = () => request.onerror?.(new Event("error"));
  return result(request);
}
export async function readVault(
  database: IDBDatabase,
  accountId: string,
): Promise<VaultEnvelope | null> {
  const tx = database.transaction("vaults", "readonly");
  const done = completed(tx);
  const envelope = (await result(tx.objectStore("vaults").get(accountId))) as
    VaultEnvelope | undefined;
  await done;
  return envelope ?? null;
}
export async function createVault(
  database: IDBDatabase,
  envelope: VaultEnvelope,
) {
  const tx = database.transaction("vaults", "readwrite");
  const done = completed(tx);
  const vaults = tx.objectStore("vaults");
  const existing = await result(vaults.get(envelope.accountId));
  if (existing) {
    tx.abort();
    await done.catch(() => {});
    throw new Error("VAULT_ALREADY_EXISTS");
  }
  vaults.add(envelope);
  await done;
}
export async function replaceVault(
  database: IDBDatabase,
  previous: VaultEnvelope,
  next: VaultEnvelope,
) {
  if (
    previous.accountId !== next.accountId ||
    previous.vaultId !== next.vaultId ||
    previous.wrappedRecovery !== next.wrappedRecovery
  )
    throw new Error("VAULT_REPLACEMENT_INVALID");
  const tx = database.transaction("vaults", "readwrite");
  const done = completed(tx);
  const vaults = tx.objectStore("vaults");
  const current = (await result(vaults.get(previous.accountId))) as
    VaultEnvelope | undefined;
  if (
    !current ||
    current.wrappedPhrase !== previous.wrappedPhrase ||
    current.wrappedRecovery !== previous.wrappedRecovery
  ) {
    tx.abort();
    await done.catch(() => {});
    throw new Error("VAULT_CONFLICT");
  }
  vaults.put(next);
  await done;
}
export async function readLocalDraft<T>(
  database: IDBDatabase,
  envelope: VaultEnvelope,
  key: CryptoKey,
) {
  const tx = database.transaction("drafts", "readonly");
  const done = completed(tx);
  const stored = (await result(
    tx.objectStore("drafts").get([envelope.accountId, DRAFT]),
  )) as StoredDraft | undefined;
  await done;
  if (!stored) return null;
  if (
    stored.accountId !== envelope.accountId ||
    stored.vaultId !== envelope.vaultId ||
    stored.draftId !== DRAFT ||
    !Number.isSafeInteger(stored.revision) ||
    stored.revision < 1
  )
    throw new Error("VAULT_DRAFT_INVALID");
  const opened = await openDraft<unknown>(key, envelope, DRAFT, stored.sealed);
  return { ...decodeStoredDraft<T>(opened), revision: stored.revision };
}
export function decodeStoredDraft<T>(opened: unknown): {
  value: T;
  remote: RemoteDraft | null;
} {
  if (opened && typeof opened === "object" && "local_vault_format" in opened) {
    const wrapped = opened as {
      local_vault_format: unknown;
      value: T;
      remote: RemoteDraft | null;
    };
    if (
      wrapped.local_vault_format !== 2 ||
      (wrapped.remote &&
        (!/^[0-9a-f-]{36}$/.test(wrapped.remote.draft_id) ||
          !/^(0|[1-9][0-9]*)$/.test(wrapped.remote.revision) ||
          (wrapped.remote.origin_draft_id !== undefined &&
            !/^[0-9a-f-]{36}$/.test(wrapped.remote.origin_draft_id)) ||
          (wrapped.remote.pending &&
            (wrapped.remote.pending.draft_id !== wrapped.remote.draft_id ||
              wrapped.remote.pending.expected_revision !==
                Number(wrapped.remote.revision) ||
              !DraftMutationSchema.safeParse(wrapped.remote.pending).success))))
    )
      throw new Error("VAULT_DRAFT_INVALID");
    return {
      value: wrapped.value,
      remote: wrapped.remote,
    };
  }
  return { value: opened as T, remote: null };
}
export async function saveLocalDraft(
  database: IDBDatabase,
  envelope: VaultEnvelope,
  key: CryptoKey,
  value: unknown,
  expectedRevision: number,
  remote: RemoteDraft | null = null,
) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    throw new Error("VAULT_REVISION_INVALID");
  const sealed = await sealDraft(key, envelope, DRAFT, {
    local_vault_format: 2,
    value,
    remote,
  });
  const estimate = await navigator.storage?.estimate?.();
  if (
    estimate?.quota !== undefined &&
    estimate.usage !== undefined &&
    estimate.quota - estimate.usage < sealed.ciphertext.length
  )
    throw new Error("VAULT_QUOTA_EXCEEDED");
  const tx = database.transaction(["vaults", "drafts"], "readwrite");
  const done = completed(tx);
  const vault = (await result(
    tx.objectStore("vaults").get(envelope.accountId),
  )) as VaultEnvelope | undefined;
  const drafts = tx.objectStore("drafts");
  const current = (await result(drafts.get([envelope.accountId, DRAFT]))) as
    StoredDraft | undefined;
  if (
    !vault ||
    vault.vaultId !== envelope.vaultId ||
    vault.wrappedPhrase !== envelope.wrappedPhrase ||
    (current?.revision ?? 0) !== expectedRevision ||
    (current && current.vaultId !== envelope.vaultId)
  ) {
    tx.abort();
    await done.catch(() => {});
    throw new Error("VAULT_CONFLICT");
  }
  const revision = expectedRevision + 1;
  drafts.put({
    accountId: envelope.accountId,
    draftId: DRAFT,
    vaultId: envelope.vaultId,
    revision,
    sealed,
  } satisfies StoredDraft);
  await done;
  return revision;
}
export async function deleteLocalDraft(
  database: IDBDatabase,
  envelope: VaultEnvelope,
  expectedRevision: number,
) {
  const tx = database.transaction(["vaults", "drafts"], "readwrite");
  const done = completed(tx);
  const vault = (await result(
    tx.objectStore("vaults").get(envelope.accountId),
  )) as VaultEnvelope | undefined;
  const drafts = tx.objectStore("drafts");
  const current = (await result(drafts.get([envelope.accountId, DRAFT]))) as
    StoredDraft | undefined;
  if (
    !vault ||
    vault.vaultId !== envelope.vaultId ||
    vault.wrappedPhrase !== envelope.wrappedPhrase ||
    !current ||
    current.revision !== expectedRevision ||
    current.vaultId !== envelope.vaultId
  ) {
    tx.abort();
    await done.catch(() => {});
    throw new Error("VAULT_CONFLICT");
  }
  drafts.delete([envelope.accountId, DRAFT]);
  await done;
}
