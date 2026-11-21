import { RetouchSubmissionSchema, RetouchSubmissionResultSchema } from "@dental-lab/contracts";
import { readLocalDraft, saveLocalDraft, deleteLocalDraft } from "./local-vault.js";
import type { VaultEnvelope } from "./vault-crypto.js";

type Request = ReturnType<typeof RetouchSubmissionSchema.parse>;
type Reply = ReturnType<typeof RetouchSubmissionResultSchema.parse>;
type Context = { db: IDBDatabase; envelope: VaultEnvelope; key: CryptoKey };
const recordId = "clinic-retouch-submission";
export type RetouchIntent = { state: "prepared" | "uncertain" | "settled"; sourceId: string; request: Request | null; reply: Reply | null; revision: number };
export async function readRetouchIntent(context: Context): Promise<RetouchIntent | null> {
  const stored = await readLocalDraft<unknown>(context.db, context.envelope, context.key, recordId);
  if (!stored) return null;
  if (stored.remote) throw new Error("RETOUCH_INTENT_INVALID");
  return parseRetouchIntent(stored.value, stored.revision);
}
export function parseRetouchIntent(raw: unknown, revision: number): RetouchIntent {
  if (!raw || typeof raw !== "object") throw new Error("RETOUCH_INTENT_INVALID");
  const value = raw as Partial<RetouchIntent>;
  const request = value.request === null ? null : RetouchSubmissionSchema.safeParse(value.request);
  const reply = value.reply === null ? null : RetouchSubmissionResultSchema.safeParse(value.reply);
  if (!value.sourceId || (value.state !== "settled" && (!request || !request.success || request.data.input.source_order_id !== value.sourceId || reply !== null)) ||
    (value.state === "settled" && (request !== null || !reply || !reply.success)) ||
    !["prepared", "uncertain", "settled"].includes(value.state ?? "")) throw new Error("RETOUCH_INTENT_INVALID");
  return { state: value.state!, sourceId: value.sourceId, request: request && request.data || null, reply: reply && reply.data || null, revision };
}
export async function stageRetouchIntent(context: Context, request: Request) {
  const previous = await readRetouchIntent(context);
  if (previous) {
    if (previous.request && JSON.stringify(previous.request) === JSON.stringify(request)) return previous;
    throw new Error("RETOUCH_INTENT_PENDING");
  }
  const value = { state: "prepared", sourceId: request.input.source_order_id, request, reply: null };
  const revision = await saveLocalDraft(context.db, context.envelope, context.key, value, 0, null, recordId);
  return { ...value, revision };
}
export async function markRetouchAttempt(context: Context, request: Request) {
  const old = await readRetouchIntent(context);
  if (!old?.request || JSON.stringify(old.request) !== JSON.stringify(request)) throw new Error("RETOUCH_INTENT_PENDING");
  if (old.state === "uncertain") return old;
  const value = { state: "uncertain", sourceId: old.sourceId, request, reply: null };
  const revision = await saveLocalDraft(context.db, context.envelope, context.key, value, old.revision, null, recordId);
  return { ...value, revision };
}
export async function settleRetouchIntent(context: Context, request: Request, reply: Reply) {
  const old = await readRetouchIntent(context);
  if (!old?.request || old.state !== "uncertain" || JSON.stringify(old.request) !== JSON.stringify(request)) throw new Error("RETOUCH_INTENT_PENDING");
  const value = { state: "settled", sourceId: old.sourceId, request: null, reply };
  const revision = await saveLocalDraft(context.db, context.envelope, context.key, value, old.revision, null, recordId);
  return { ...value, revision };
}
export async function clearRetouchIntent(context: Context, sourceId: string) {
  const old = await readRetouchIntent(context);
  if (!old || old.sourceId !== sourceId || old.state !== "settled") throw new Error("RETOUCH_INTENT_PENDING");
  await deleteLocalDraft(context.db, context.envelope, old.revision, recordId);
}
