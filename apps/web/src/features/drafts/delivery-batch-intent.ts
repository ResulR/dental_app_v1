import {
  DeliveryBatchCommandSchema,
  DeliveryBatchResultSchema,
  type DeliveryBatchCommand,
  type DeliveryBatchResult,
} from "@dental-lab/contracts";
import {
  readLocalDraft,
  saveLocalDraft,
  deleteLocalDraft,
} from "./local-vault.js";
import type { LaboratoryOrderVault } from "./laboratory-order-intent.js";

const recordId = "laboratory-delivery-batch";
type Receipt = Extract<DeliveryBatchResult, { kind: "delivered" }>;
export type BatchIntent = {
  state: "uncertain" | "settled";
  command: DeliveryBatchCommand;
  reply: Receipt | null;
  revision: number;
};

export function matchesBatchReceipt(
  command: DeliveryBatchCommand,
  reply: Receipt,
) {
  return (
    reply.receipt_id === command.receipt_id &&
    reply.items.length === command.items.length &&
    new Set(reply.items.map((item) => item.order_id)).size ===
      command.items.length &&
    reply.items.every((item) => {
      const source = command.items.find(
        (row) => row.order_id === item.order_id,
      );
      return source && item.revision === source.expected_revision + 1;
    })
  );
}

export function parseBatchIntent(
  raw: unknown,
  revision: number,
  accountId: string,
): BatchIntent {
  if (
    !raw ||
    typeof raw !== "object" ||
    !Number.isSafeInteger(revision) ||
    revision < 1
  )
    throw new Error("BATCH_INTENT_INVALID");
  const value = raw as Record<string, unknown>;
  const command = DeliveryBatchCommandSchema.safeParse(value.command);
  const reply =
    value.reply === null
      ? null
      : DeliveryBatchResultSchema.safeParse(value.reply);
  if (
    value.accountId !== accountId ||
    !command.success ||
    (value.state !== "uncertain" && value.state !== "settled") ||
    (value.state === "uncertain" && reply !== null) ||
    (value.state === "settled" &&
      (!reply ||
        !reply.success ||
        reply.data.kind !== "delivered" ||
        !matchesBatchReceipt(command.data, reply.data)))
  )
    throw new Error("BATCH_INTENT_INVALID");
  return {
    state: value.state,
    command: command.data,
    reply:
      reply && reply.success && reply.data.kind === "delivered"
        ? reply.data
        : null,
    revision,
  };
}

export async function readBatchIntent(
  vault: LaboratoryOrderVault,
  accountId: string,
) {
  if (vault.envelope.accountId !== accountId)
    throw new Error("BATCH_INTENT_ACCOUNT");
  const record = await readLocalDraft<unknown>(
    vault.db,
    vault.envelope,
    vault.key,
    recordId,
  );
  if (!record) return null;
  if (record.remote) throw new Error("BATCH_INTENT_INVALID");
  return parseBatchIntent(record.value, record.revision, accountId);
}

export async function storeBatchIntent(
  vault: LaboratoryOrderVault,
  accountId: string,
  command: DeliveryBatchCommand,
) {
  if (await readBatchIntent(vault, accountId))
    throw new Error("BATCH_INTENT_PENDING");
  const parsed = DeliveryBatchCommandSchema.parse(command);
  await saveLocalDraft(
    vault.db,
    vault.envelope,
    vault.key,
    { state: "uncertain", accountId, command: parsed, reply: null },
    0,
    null,
    recordId,
  );
  return readBatchIntent(vault, accountId);
}

export async function settleBatchIntent(
  vault: LaboratoryOrderVault,
  accountId: string,
  command: DeliveryBatchCommand,
  reply: Receipt,
) {
  const current = await readBatchIntent(vault, accountId);
  if (
    current?.state !== "uncertain" ||
    JSON.stringify(current.command) !== JSON.stringify(command) ||
    !matchesBatchReceipt(command, reply)
  )
    throw new Error("BATCH_INTENT_CONFLICT");
  await saveLocalDraft(
    vault.db,
    vault.envelope,
    vault.key,
    { state: "settled", accountId, command, reply },
    current.revision,
    null,
    recordId,
  );
  return readBatchIntent(vault, accountId);
}

export async function clearBatchIntent(
  vault: LaboratoryOrderVault,
  accountId: string,
) {
  const current = await readBatchIntent(vault, accountId);
  if (current?.state !== "settled") throw new Error("BATCH_INTENT_PENDING");
  await deleteLocalDraft(vault.db, vault.envelope, current.revision, recordId);
}
