import { test, expect, vi } from "vitest";
import { LaboratoryClinicOrderSchema } from "@dental-lab/contracts";
import {
  parseLaboratoryOrderIntent,
  prepareLaboratoryOrderAttempt,
  settleLaboratoryOrderIntent,
  readLaboratoryOrderIntent,
  clearLaboratoryOrderIntent,
} from "../../apps/web/src/features/drafts/laboratory-order-intent.ts";
import {
  readLocalDraft,
  saveLocalDraft,
  deleteLocalDraft,
} from "../../apps/web/src/features/drafts/local-vault.ts";
vi.mock("../../apps/web/src/features/drafts/local-vault.ts", () => ({
  readLocalDraft: vi.fn(),
  saveLocalDraft: vi.fn(),
  deleteLocalDraft: vi.fn(),
}));
const account = "94000000-0000-4000-8000-000000000001",
  clinic = "94000000-0000-4000-8000-000000000002";
const request = LaboratoryClinicOrderSchema.parse({
  clinic_id: clinic,
  idempotency_key: account,
  confirmed_warnings: false,
  input: {
    patient: { internal_reference: "Fiktive" },
    requested_delivery_date: null,
    material_id: account,
    shade_id: clinic,
    teeth: [],
    file_ids: [],
  },
});
const context = { db: {}, envelope: { accountId: account }, key: {} };
function fixture() {
  let value = null,
    revision = 0;
  readLocalDraft.mockImplementation(async (_db, _envelope, _key, recordId) => {
    expect(recordId).toBe("laboratory-clinic-order");
    return value ? { value, revision, remote: null } : null;
  });
  saveLocalDraft.mockImplementation(
    async (_db, _envelope, _key, next, expected) => {
      expect(expected).toBe(revision);
      value = next;
      return ++revision;
    },
  );
  deleteLocalDraft.mockImplementation(async (_db, _envelope, expected) => {
    expect(expected).toBe(revision);
    value = null;
  });
  return () => value;
}
test("persist before departure, recover exact intention after reopening, replay and settle receipt", async () => {
  const saved = fixture();
  const signal = new AbortController().signal;
  await prepareLaboratoryOrderAttempt(context, account, request, signal);
  expect(saved().state).toBe("uncertain");
  expect((await readLaboratoryOrderIntent(context, account)).request).toEqual(
    request,
  );
  await prepareLaboratoryOrderAttempt(context, account, request, signal);
  const reply = {
    kind: "submitted",
    persisted: true,
    order_id: account,
    number: "11",
    received_at: "2026-11-26T08:00:00.000Z",
    replayed: true,
  };
  await settleLaboratoryOrderIntent(context, account, request, reply);
  expect((await readLaboratoryOrderIntent(context, account)).reply).toEqual(
    reply,
  );
  await expect(
    prepareLaboratoryOrderAttempt(context, account, request, signal),
  ).rejects.toThrow("LABORATORY_INTENT_PENDING");
  await clearLaboratoryOrderIntent(context, account);
  expect(saved()).toBeNull();
});
test("foreign account, clinic and changed payload never reuse the saved idempotency key", async () => {
  fixture();
  const signal = new AbortController().signal;
  await prepareLaboratoryOrderAttempt(context, account, request, signal);
  await expect(readLaboratoryOrderIntent(context, clinic)).rejects.toThrow(
    "LABORATORY_INTENT_ACCOUNT",
  );
  await expect(
    prepareLaboratoryOrderAttempt(
      context,
      account,
      { ...request, clinic_id: account },
      signal,
    ),
  ).rejects.toThrow("LABORATORY_INTENT_PENDING");
  await expect(
    prepareLaboratoryOrderAttempt(
      context,
      account,
      { ...request, input: { ...request.input, description: "Autre" } },
      signal,
    ),
  ).rejects.toThrow("LABORATORY_INTENT_PENDING");
  expect(() =>
    parseLaboratoryOrderIntent(
      {
        state: "uncertain",
        accountId: clinic,
        clinicId: clinic,
        request,
        reply: null,
      },
      1,
      account,
    ),
  ).toThrow();
});
test("abort during durable staging prevents any network departure", async () => {
  fixture();
  const controller = new AbortController();
  saveLocalDraft.mockImplementationOnce(async () => {
    controller.abort();
    return 1;
  });
  await expect(
    prepareLaboratoryOrderAttempt(context, account, request, controller.signal),
  ).rejects.toThrow();
});
