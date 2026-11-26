import { expect, test, vi } from "vitest";
import { RetouchSubmissionSchema } from "@dental-lab/contracts";
import { prepareRetouchAttempt } from "../../apps/web/src/features/drafts/retouch-intent.ts";
import { readLocalDraft, saveLocalDraft } from "../../apps/web/src/features/drafts/local-vault.ts";

vi.mock("../../apps/web/src/features/drafts/local-vault.ts", () => ({
  readLocalDraft: vi.fn(), saveLocalDraft: vi.fn(), deleteLocalDraft: vi.fn(),
}));
const id = "94000000-0000-4000-8000-000000000001";
const request = RetouchSubmissionSchema.parse({idempotency_key:id,confirmed_warnings:false,input:{source_order_id:id,expected_source_version_id:id,expected_source_revision:1,intervention_kind:"retouch",material_id:id,shade_id:id,description:"Fiktiv",file_ids:[]}});
test.each(["prepared","uncertain",null])("departure during durable preparation (%s) prevents sending", async (interruptAt) => {
  const controller = new globalThis.AbortController();
  let record = null;
  const states = [];
  readLocalDraft.mockImplementation(async () => record);
  saveLocalDraft.mockImplementation(async (_db,_env,_key,value) => {
    states.push(value.state);
    record = {value,revision:states.length,remote:null};
    if (value.state === interruptAt) controller.abort();
    return states.length;
  });
  const send = vi.fn();
  const completion = prepareRetouchAttempt({},request,controller.signal).then(send);
  if (interruptAt) {
    await expect(completion).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
    expect(record.value.request).toEqual(request);
  } else {
    await completion;
    expect(send).toHaveBeenCalledTimes(1);
  }
  expect(states).toEqual(interruptAt === "prepared" ? ["prepared"] : ["prepared","uncertain"]);
});
