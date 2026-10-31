import { z } from "zod";
import {
  OrderSubmissionResultSchema,
  OrderSubmissionSchema,
} from "@dental-lab/contracts";
import {
  deleteLocalDraft,
  readLocalDraft,
  saveLocalDraft,
} from "./local-vault.js";
import type { VaultEnvelope } from "./vault-crypto.js";

export type SubmissionRequest = ReturnType<typeof OrderSubmissionSchema.parse>;
export type SubmissionReply = ReturnType<
  typeof OrderSubmissionResultSchema.parse
>;
export type StoredSubmission = {
  format: 1;
  state: "prepared" | "uncertain" | "settled";
  idempotency_key: string;
  request: SubmissionRequest | null;
  reply: SubmissionReply | null;
  linked_draft?: { draft_id: string; draft_revision: number };
};
const recordId = "clinic-order-submission";
type Context = { db: IDBDatabase; envelope: VaultEnvelope; key: CryptoKey };

export function parseStoredSubmission(raw: unknown): StoredSubmission {
  if (!raw || typeof raw !== "object")
    throw new Error("SUBMISSION_INTENT_INVALID");
  const value = raw as Partial<StoredSubmission>;
  const request =
    value.request === null
      ? null
      : OrderSubmissionSchema.safeParse(value.request);
  const key = z.uuid().safeParse(value.idempotency_key);
  const reply =
    value.reply === null
      ? null
      : OrderSubmissionResultSchema.safeParse(value.reply);
  if (
    value.format !== 1 ||
    !["prepared", "uncertain", "settled"].includes(value.state ?? "") ||
    !key.success
  )
    throw new Error("SUBMISSION_INTENT_INVALID");
  if (value.state === "settled") {
    if (request !== null || reply === null || !reply.success)
      throw new Error("SUBMISSION_INTENT_INVALID");
    const linked = z
      .strictObject({
        draft_id: z.uuid(),
        draft_revision: z.number().int().min(1).max(2147483647),
      })
      .safeParse(value.linked_draft);
    if (
      value.linked_draft !== undefined &&
      (!linked.success || reply.data.kind !== "submitted")
    )
      throw new Error("SUBMISSION_INTENT_INVALID");
    return {
      format: 1,
      state: "settled",
      idempotency_key: key.data,
      request: null,
      reply: reply.data,
      ...(linked.success ? { linked_draft: linked.data } : {}),
    };
  }
  if (
    request === null ||
    !request.success ||
    request.data.idempotency_key !== key.data ||
    reply !== null
  )
    throw new Error("SUBMISSION_INTENT_INVALID");
  return {
    format: 1,
    state: value.state as "prepared" | "uncertain",
    idempotency_key: key.data,
    request: request.data,
    reply: null,
  };
}
export async function readSubmissionIntent(context: Context) {
  const stored = await readLocalDraft<unknown>(
    context.db,
    context.envelope,
    context.key,
    recordId,
  );
  if (!stored) return null;
  if (stored.remote) throw new Error("SUBMISSION_INTENT_INVALID");
  return { ...parseStoredSubmission(stored.value), revision: stored.revision };
}
function sameRequest(a: SubmissionRequest, b: SubmissionRequest) {
  return JSON.stringify(a) === JSON.stringify(b);
}
export async function stageSubmissionIntent(context: Context, raw: unknown) {
  const request = OrderSubmissionSchema.parse(raw);
  const previous = await readSubmissionIntent(context);
  if (previous) {
    if (
      previous.request &&
      sameRequest(previous.request, request) &&
      previous.state !== "settled"
    )
      return previous;
    throw new Error("SUBMISSION_INTENT_PENDING");
  }
  const value: StoredSubmission = {
    format: 1,
    state: "prepared",
    idempotency_key: request.idempotency_key,
    request,
    reply: null,
  };
  const revision = await saveLocalDraft(
    context.db,
    context.envelope,
    context.key,
    value,
    0,
    null,
    recordId,
  );
  return { ...value, revision };
}
export async function markSubmissionAttempt(
  context: Context,
  request: SubmissionRequest,
) {
  const current = await readSubmissionIntent(context);
  if (
    !current ||
    !current.request ||
    !sameRequest(current.request, request) ||
    current.state === "settled"
  )
    throw new Error("SUBMISSION_INTENT_PENDING");
  if (current.state === "uncertain") return current;
  const value: StoredSubmission = { ...current, state: "uncertain" };
  const revision = await saveLocalDraft(
    context.db,
    context.envelope,
    context.key,
    value,
    current.revision,
    null,
    recordId,
  );
  return { ...value, revision };
}
export async function recordSubmissionReply(
  context: Context,
  request: SubmissionRequest,
  raw: unknown,
) {
  const reply = OrderSubmissionResultSchema.parse(raw);
  const current = await readSubmissionIntent(context);
  if (
    !current ||
    current.idempotency_key !== request.idempotency_key ||
    (current.request !== null && !sameRequest(current.request, request)) ||
    current.state === "prepared"
  )
    throw new Error("SUBMISSION_INTENT_PENDING");
  if (current.state === "settled") {
    if (JSON.stringify(current.reply) !== JSON.stringify(reply))
      throw new Error("SUBMISSION_INTENT_CONFLICT");
    return current;
  }
  // Officially submitted orders must not remain cached as complete requests.
  const value: StoredSubmission = {
    ...current,
    state: "settled",
    request: null,
    reply,
    ...(reply.kind === "submitted" && request.draft_id && request.draft_revision
      ? {
          linked_draft: {
            draft_id: request.draft_id,
            draft_revision: request.draft_revision,
          },
        }
      : {}),
  };
  const revision = await saveLocalDraft(
    context.db,
    context.envelope,
    context.key,
    value,
    current.revision,
    null,
    recordId,
  );
  return { ...value, revision };
}
export async function clearSettledSubmission(
  context: Context,
  idempotencyKey: string,
) {
  const current = await readSubmissionIntent(context);
  if (
    !current ||
    current.state !== "settled" ||
    current.idempotency_key !== idempotencyKey
  )
    throw new Error("SUBMISSION_INTENT_PENDING");
  await deleteLocalDraft(
    context.db,
    context.envelope,
    current.revision,
    recordId,
  );
}
