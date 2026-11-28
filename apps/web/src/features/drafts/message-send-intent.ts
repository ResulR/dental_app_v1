import {
  MessageSubmissionSchema,
  MessageSubmissionResultSchema,
  type MessageSubmission,
  type MessageSubmissionResult,
} from "@dental-lab/contracts";
import {
  readLocalDraft,
  saveLocalDraft,
  deleteLocalDraft,
} from "./local-vault.js";
import type { LaboratoryOrderVault } from "./laboratory-order-intent.js";

const recordId = "messaging-send-intent";
type Receipt =
  | Extract<MessageSubmissionResult, { kind: "sent" }>
  | {
      kind: "conversation_closed";
      persisted: false;
    };
export type MessageSendIntent = {
  state: "uncertain" | "settled";
  accountId: string;
  kind: "general" | "order";
  request: MessageSubmission;
  reply: Receipt | null;
  revision: number;
};

export function parseMessageSendIntent(
  raw: unknown,
  revision: number,
  accountId: string,
): MessageSendIntent {
  if (
    !raw ||
    typeof raw !== "object" ||
    !Number.isSafeInteger(revision) ||
    revision < 1
  )
    throw new Error("MESSAGE_INTENT_INVALID");
  const value = raw as Record<string, unknown>;
  const request = MessageSubmissionSchema.safeParse(value.request);
  const reply =
    value.reply === null
      ? null
      : MessageSubmissionResultSchema.safeParse(value.reply);
  if (
    value.accountId !== accountId ||
    (value.kind !== "general" && value.kind !== "order") ||
    !request.success ||
    request.data.body === null ||
    request.data.file_ids.length !== 0 ||
    (value.state !== "uncertain" && value.state !== "settled") ||
    (value.state === "uncertain" && reply !== null) ||
    (value.state === "settled" &&
      (!reply ||
        !reply.success ||
        !["sent", "conversation_closed"].includes(reply.data.kind)))
  )
    throw new Error("MESSAGE_INTENT_INVALID");
  return {
    accountId,
    kind: value.kind,
    state: value.state,
    request: request.data,
    reply:
      reply?.success && reply.data.kind === "sent"
        ? reply.data
        : reply?.success && reply.data.kind === "conversation_closed"
          ? { kind: "conversation_closed", persisted: false }
          : null,
    revision,
  };
}
export async function readMessageSendIntent(
  vault: LaboratoryOrderVault,
  accountId: string,
) {
  if (vault.envelope.accountId !== accountId)
    throw new Error("MESSAGE_INTENT_ACCOUNT");
  const record = await readLocalDraft<unknown>(
    vault.db,
    vault.envelope,
    vault.key,
    recordId,
  );
  if (!record) return null;
  if (record.remote) throw new Error("MESSAGE_INTENT_INVALID");
  return parseMessageSendIntent(record.value, record.revision, accountId);
}
export async function storeMessageSendIntent(
  vault: LaboratoryOrderVault,
  accountId: string,
  kind: "general" | "order",
  request: MessageSubmission,
) {
  if (await readMessageSendIntent(vault, accountId))
    throw new Error("MESSAGE_INTENT_PENDING");
  const parsed = MessageSubmissionSchema.parse(request);
  if (parsed.body === null || parsed.file_ids.length)
    throw new Error("MESSAGE_FILES_UNAVAILABLE");
  await saveLocalDraft(
    vault.db,
    vault.envelope,
    vault.key,
    { accountId, kind, state: "uncertain", request: parsed, reply: null },
    0,
    null,
    recordId,
  );
  return readMessageSendIntent(vault, accountId);
}
export async function settleMessageSendIntent(
  vault: LaboratoryOrderVault,
  accountId: string,
  kind: "general" | "order",
  request: MessageSubmission,
  reply: Receipt,
) {
  const current = await readMessageSendIntent(vault, accountId);
  if (
    current?.state !== "uncertain" ||
    current.kind !== kind ||
    JSON.stringify(current.request) !== JSON.stringify(request)
  )
    throw new Error("MESSAGE_INTENT_CONFLICT");
  await saveLocalDraft(
    vault.db,
    vault.envelope,
    vault.key,
    { accountId, kind, state: "settled", request: current.request, reply },
    current.revision,
    null,
    recordId,
  );
  return readMessageSendIntent(vault, accountId);
}
export async function clearMessageSendIntent(
  vault: LaboratoryOrderVault,
  accountId: string,
) {
  const current = await readMessageSendIntent(vault, accountId);
  if (current?.state !== "settled") throw new Error("MESSAGE_INTENT_PENDING");
  await deleteLocalDraft(vault.db, vault.envelope, current.revision, recordId);
}
