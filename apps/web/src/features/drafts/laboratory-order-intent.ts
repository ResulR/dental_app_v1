import { z } from "zod";
import {
  LaboratoryClinicOrderSchema,
  LaboratoryClinicOrderResultSchema,
} from "@dental-lab/contracts";
import {
  readLocalDraft,
  saveLocalDraft,
  deleteLocalDraft,
} from "./local-vault.js";
import type { VaultEnvelope } from "./vault-crypto.js";

type Request = ReturnType<typeof LaboratoryClinicOrderSchema.parse>;
type Reply = ReturnType<typeof LaboratoryClinicOrderResultSchema.parse>;
export type LaboratoryOrderVault = {
  db: IDBDatabase;
  envelope: VaultEnvelope;
  key: CryptoKey;
};
const recordId = "laboratory-clinic-order";

export function parseLaboratoryOrderIntent(
  raw: unknown,
  revision: number,
  accountId: string,
) {
  if (!raw || typeof raw !== "object")
    throw new Error("LABORATORY_INTENT_INVALID");
  const value = raw as Record<string, unknown>;
  const request =
    value.request === null
      ? null
      : LaboratoryClinicOrderSchema.safeParse(value.request);
  const reply =
    value.reply === null
      ? null
      : LaboratoryClinicOrderResultSchema.safeParse(value.reply);
  if (
    value.accountId !== accountId ||
    !Number.isSafeInteger(revision) ||
    revision < 1 ||
    (value.state !== "prepared" &&
      value.state !== "uncertain" &&
      value.state !== "settled") ||
    (value.state === "settled"
      ? request !== null ||
        !reply ||
        !reply.success ||
        typeof value.clinicId !== "string" ||
        !z.uuid().safeParse(value.clinicId).success
      : !request ||
        !request.success ||
        reply !== null ||
        value.clinicId !== request.data.clinic_id)
  )
    throw new Error("LABORATORY_INTENT_INVALID");
  return {
    state: value.state,
    accountId,
    clinicId: value.clinicId as string,
    request: (request && request.data) || null,
    reply: (reply && reply.data) || null,
    revision,
  };
}

export async function readLaboratoryOrderIntent(
  context: LaboratoryOrderVault,
  accountId: string,
) {
  if (context.envelope.accountId !== accountId)
    throw new Error("LABORATORY_INTENT_ACCOUNT");
  const record = await readLocalDraft<unknown>(
    context.db,
    context.envelope,
    context.key,
    recordId,
  );
  if (!record) return null;
  if (record.remote) throw new Error("LABORATORY_INTENT_INVALID");
  return parseLaboratoryOrderIntent(record.value, record.revision, accountId);
}

export async function prepareLaboratoryOrderAttempt(
  context: LaboratoryOrderVault,
  accountId: string,
  request: Request,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const existing = await readLaboratoryOrderIntent(context, accountId);
  if (
    existing &&
    (!existing.request ||
      JSON.stringify(existing.request) !== JSON.stringify(request))
  )
    throw new Error("LABORATORY_INTENT_PENDING");
  if (!existing) {
    await saveLocalDraft(
      context.db,
      context.envelope,
      context.key,
      {
        state: "prepared",
        accountId,
        clinicId: request.clinic_id,
        request,
        reply: null,
      },
      0,
      null,
      recordId,
    );
  }
  signal.throwIfAborted();
  const current = await readLaboratoryOrderIntent(context, accountId);
  if (
    !current?.request ||
    JSON.stringify(current.request) !== JSON.stringify(request)
  )
    throw new Error("LABORATORY_INTENT_CONFLICT");
  if (current.state === "prepared")
    await saveLocalDraft(
      context.db,
      context.envelope,
      context.key,
      {
        state: "uncertain",
        accountId,
        clinicId: request.clinic_id,
        request,
        reply: null,
      },
      current.revision,
      null,
      recordId,
    );
  signal.throwIfAborted();
}

export async function settleLaboratoryOrderIntent(
  context: LaboratoryOrderVault,
  accountId: string,
  request: Request,
  reply: Reply,
) {
  const current = await readLaboratoryOrderIntent(context, accountId);
  if (
    current?.state !== "uncertain" ||
    !current.request ||
    JSON.stringify(current.request) !== JSON.stringify(request)
  )
    throw new Error("LABORATORY_INTENT_CONFLICT");
  await saveLocalDraft(
    context.db,
    context.envelope,
    context.key,
    {
      state: "settled",
      accountId,
      clinicId: request.clinic_id,
      request: null,
      reply,
    },
    current.revision,
    null,
    recordId,
  );
}

export async function clearLaboratoryOrderIntent(
  context: LaboratoryOrderVault,
  accountId: string,
) {
  const current = await readLaboratoryOrderIntent(context, accountId);
  if (!current || current.state !== "settled")
    throw new Error("LABORATORY_INTENT_PENDING");
  await deleteLocalDraft(
    context.db,
    context.envelope,
    current.revision,
    recordId,
  );
}
