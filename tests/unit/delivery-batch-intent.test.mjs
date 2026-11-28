import { test, expect, vi } from "vitest";
import {
  parseBatchIntent,
  readBatchIntent,
  storeBatchIntent,
  settleBatchIntent,
  clearBatchIntent,
  matchesBatchReceipt,
} from "../../apps/web/src/features/drafts/delivery-batch-intent.ts";
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
const account = uuid(9);
const vault = { db: {}, envelope: { accountId: account }, key: {} };
const command = {
  receipt_id: uuid(99),
  confirmed: true,
  items: [1, 2].map((n) => ({
    order_id: uuid(n),
    expected_version_id: uuid(n + 10),
    expected_revision: n,
    mode: "clinic_pickup",
  })),
};
const reply = {
  kind: "delivered",
  receipt_id: command.receipt_id,
  delivered_at: "2026-11-28T09:00:00Z",
  items: command.items.map((row) => ({
    order_id: row.order_id,
    revision: row.expected_revision + 1,
  })),
};
function fixture() {
  let value = null;
  let revision = 0;
  readLocalDraft.mockImplementation(async (_db, _envelope, _key, id) => {
    expect(id).toBe("laboratory-delivery-batch");
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
test("durable intent survives reopen and cannot silently change or disappear before settlement", async () => {
  const saved = fixture();
  await storeBatchIntent(vault, account, command);
  expect(saved().command).toEqual(command);
  const reopened = await readBatchIntent(vault, account);
  expect(reopened.state).toBe("uncertain");
  expect(reopened.command.receipt_id).toBe(command.receipt_id);
  await expect(
    storeBatchIntent(vault, account, { ...command, receipt_id: uuid(98) }),
  ).rejects.toThrow("BATCH_INTENT_PENDING");
  await expect(clearBatchIntent(vault, account)).rejects.toThrow(
    "BATCH_INTENT_PENDING",
  );
  await settleBatchIntent(vault, account, command, reply);
  expect((await readBatchIntent(vault, account)).reply).toEqual(reply);
  await clearBatchIntent(vault, account);
  expect(saved()).toBeNull();
});
test("account, receipt, order membership, revisions and changed payload are rejected", async () => {
  fixture();
  await storeBatchIntent(vault, account, command);
  await expect(readBatchIntent(vault, uuid(8))).rejects.toThrow(
    "BATCH_INTENT_ACCOUNT",
  );
  expect(matchesBatchReceipt(command, { ...reply, receipt_id: uuid(98) })).toBe(
    false,
  );
  expect(
    matchesBatchReceipt(command, {
      ...reply,
      items: [{ order_id: uuid(3), revision: 2 }, reply.items[1]],
    }),
  ).toBe(false);
  expect(
    matchesBatchReceipt(command, {
      ...reply,
      items: [{ ...reply.items[0], revision: 9 }, reply.items[1]],
    }),
  ).toBe(false);
  expect(
    matchesBatchReceipt(command, {
      ...reply,
      items: [reply.items[0], reply.items[0]],
    }),
  ).toBe(false);
  await expect(
    settleBatchIntent(vault, account, command, {
      ...reply,
      receipt_id: uuid(98),
    }),
  ).rejects.toThrow("BATCH_INTENT_CONFLICT");
  await expect(
    settleBatchIntent(
      vault,
      account,
      {
        ...command,
        items: command.items.map((item) => ({
          ...item,
          mode: "external_courier",
        })),
      },
      reply,
    ),
  ).rejects.toThrow("BATCH_INTENT_CONFLICT");
  expect(() =>
    parseBatchIntent(
      {
        state: "settled",
        accountId: account,
        command,
        reply: { ...reply, receipt_id: uuid(98) },
      },
      1,
      account,
    ),
  ).toThrow("BATCH_INTENT_INVALID");
});
