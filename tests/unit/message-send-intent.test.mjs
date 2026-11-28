import { test, expect, vi } from "vitest";
import {
  readMessageSendIntent,
  storeMessageSendIntent,
  settleMessageSendIntent,
  clearMessageSendIntent,
  parseMessageSendIntent,
} from "../../apps/web/src/features/drafts/message-send-intent.ts";
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
const uuid = (n) => "92000000-0000-4000-8000-" + String(n).padStart(12, "0");
const account = uuid(1),
  conversation = uuid(2);
const vault = { db: {}, envelope: { accountId: account }, key: {} };
const request = {
  conversation_id: conversation,
  idempotency_key: uuid(3),
  body: "Mesazh",
  file_ids: [],
};
const reply = {
  kind: "sent",
  persisted: true,
  message_id: uuid(4),
  version_id: uuid(5),
  sequence_number: 2,
  created_at: "2026-11-28T08:00:00.000Z",
  replayed: true,
};
function fixture() {
  let value = null,
    revision = 0;
  readLocalDraft.mockImplementation(async (_db, _envelope, _key, id) => {
    expect(id).toBe("messaging-send-intent");
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
test("exact text and key survive close; no new intent or removal until confirmed", async () => {
  const saved = fixture();
  await storeMessageSendIntent(vault, account, "general", request);
  expect(saved().request).toEqual(request);
  expect((await readMessageSendIntent(vault, account)).request).toEqual(
    request,
  );
  await expect(
    storeMessageSendIntent(vault, account, "general", {
      ...request,
      body: "Changed",
    }),
  ).rejects.toThrow("MESSAGE_INTENT_PENDING");
  await expect(clearMessageSendIntent(vault, account)).rejects.toThrow(
    "MESSAGE_INTENT_PENDING",
  );
  await settleMessageSendIntent(vault, account, "general", request, reply);
  expect((await readMessageSendIntent(vault, account)).reply).toEqual(reply);
  await clearMessageSendIntent(vault, account);
  expect(saved()).toBeNull();
});
test("foreign account, conversation, kind, reply and files never settle or reuse key", async () => {
  fixture();
  await storeMessageSendIntent(vault, account, "order", request);
  await expect(readMessageSendIntent(vault, uuid(9))).rejects.toThrow(
    "MESSAGE_INTENT_ACCOUNT",
  );
  await expect(
    settleMessageSendIntent(vault, account, "general", request, reply),
  ).rejects.toThrow("MESSAGE_INTENT_CONFLICT");
  await expect(
    settleMessageSendIntent(
      vault,
      account,
      "order",
      { ...request, conversation_id: uuid(9) },
      reply,
    ),
  ).rejects.toThrow("MESSAGE_INTENT_CONFLICT");
  expect(() =>
    parseMessageSendIntent(
      {
        accountId: account,
        kind: "order",
        state: "settled",
        request,
        reply: { kind: "conflict", persisted: false },
      },
      1,
      account,
    ),
  ).toThrow("MESSAGE_INTENT_INVALID");
  await expect(
    storeMessageSendIntent(vault, account, "order", {
      ...request,
      file_ids: [uuid(8)],
    }),
  ).rejects.toThrow("MESSAGE_INTENT_PENDING");
  expect(() =>
    parseMessageSendIntent(
      {
        accountId: account,
        kind: "order",
        state: "uncertain",
        request: { ...request, file_ids: [uuid(8)] },
        reply: null,
      },
      1,
      account,
    ),
  ).toThrow("MESSAGE_INTENT_INVALID");
});

test("confirmed closed conversation may be cleared without claiming a message was sent", async () => {
  fixture();
  await storeMessageSendIntent(vault, account, "order", request);
  await settleMessageSendIntent(vault, account, "order", request, {
    kind: "conversation_closed",
    persisted: false,
  });
  expect((await readMessageSendIntent(vault, account)).reply.kind).toBe(
    "conversation_closed",
  );
  await clearMessageSendIntent(vault, account);
});
