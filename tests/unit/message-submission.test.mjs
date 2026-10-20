import { test, expect, vi } from "vitest";
import { createMessageSubmissionService } from "../../apps/api/dist/modules/messaging/index.js";
const id = "91000000-0000-4000-8000-000000000001";
const foreign = "91000000-0000-4000-8000-000000000002";
const actor = { accountId: id, sessionId: id };
const command = {
  conversation_id: id,
  idempotency_key: id,
  body: "Synthetic text",
  file_ids: [],
};
const policy = { storagePolicyVersion: "test", capacityPolicyVersion: "test" };
const file = {
  id,
  clinic_id: id,
  created_by: id,
  state: "ready",
  size_bytes: "3",
  content_sha256: Buffer.alloc(32),
  media_type_verified: "model/stl",
  verified_at: new Date(),
  storage_policy_version: "test",
};
const upload = {
  id,
  file_id: id,
  revision: "1",
  declared_size: "3",
  received_bytes: "3",
};
// In-memory transactional double; never evidence of PostgreSQL constraints or storage.
function fixture(patch = {}) {
  const state = { writes: [], message: null, seq: 0 },
    calls = [];
  let queue = Promise.resolve();
  const transaction = vi.fn((work) => {
    const task = queue.then(async () => {
      const draft = { ...state, writes: [...state.writes] };
      const query = async (sql, values = []) => {
        calls.push([sql, values]);
        if (sql.startsWith("SELECT a.profile"))
          return {
            rows: patch.revoked
              ? []
              : [
                  {
                    profile: patch.profile ?? "clinic",
                    lifecycle: "active",
                    securityLocked: false,
                    resetRequired: false,
                    sessionValid: true,
                    ownerCurrent: true,
                    clinicId: id,
                    clinicSuspended: patch.suspended ?? false,
                    grants: patch.grants ?? [],
                  },
                ],
          };
        if (
          sql.startsWith(
            "SELECT id FROM public.clinics WHERE account_id=$1 AND",
          )
        )
          return { rows: patch.unapproved ? [] : [{ id }] };
        if (sql.startsWith("SELECT id,clinic_id,kind,order_id,closed_at"))
          return {
            rows: patch.foreign
              ? []
              : [
                  {
                    id,
                    clinic_id: id,
                    kind: patch.kind ?? "order",
                    order_id: patch.kind === "general" ? null : id,
                    closed_at: patch.closed ? new Date() : null,
                    last_message_seq: String(draft.seq),
                  },
                ],
          };
        if (
          sql.startsWith("SELECT id,current_version_id,sequence_number::text")
        )
          return {
            rows:
              draft.message && draft.message.idempotency_key === values[2]
                ? [draft.message]
                : [],
          };
        if (sql.includes("FROM public.file_objects"))
          return { rows: patch.files ?? [] };
        if (sql.includes("FROM public.upload_sessions"))
          return { rows: patch.uploads ?? [] };
        if (sql.startsWith("SELECT file_id FROM public.message_version_files"))
          return { rows: patch.bound ? [{ file_id: id }] : [] };
        if (sql.startsWith("UPDATE public.upload_sessions")) {
          if (patch.expiredAtAttach) return { rows: [] };
          draft.writes.push([sql, values]);
          return { rows: [{ id }] };
        }
        if (sql.startsWith("UPDATE public.conversations")) {
          if (patch.closedAtInsert) return { rows: [] };
          draft.seq++;
          draft.writes.push([sql, values]);
          return { rows: [{ last_message_seq: String(draft.seq) }] };
        }
        if (sql.startsWith("INSERT")) {
          if (patch.failAt && sql.includes(patch.failAt))
            throw Error("SYNTHETIC_FAILURE");
          draft.writes.push([sql, values]);
          if (sql.startsWith("INSERT INTO public.messages(")) {
            draft.message = {
              id: values[0],
              current_version_id: values[6],
              sequence_number: values[3],
              created_at: new Date("2026-10-20T14:00:00Z"),
              payload_fingerprint: values[8],
              idempotency_key: values[7],
            };
            return { rows: [draft.message] };
          }
        }
        return { rows: [] };
      };
      const result = await work({ query });
      if (patch.commitFailure) throw Error("COMMIT_UNCERTAIN");
      Object.assign(state, draft);
      return result;
    });
    queue = task.catch(() => {});
    return task;
  });
  return { state, calls, transaction };
}
test("messages and files share one transaction with ordered sequence, audit and replay", async () => {
  const db = fixture({ files: [file], uploads: [upload] });
  const service = createMessageSubmissionService(db, policy);
  const cmd = { ...command, body: null, file_ids: [id] };
  const sent = await service.send(actor, cmd);
  expect(sent.result).toMatchObject({
    kind: "sent",
    persisted: true,
    sequence_number: 1,
    replayed: false,
  });
  const inserts = db.state.writes.map(([sql]) => sql).join("\n");
  for (const name of [
    "messages",
    "message_versions",
    "message_version_files",
    "file_events",
    "outbox_events",
    "outbox_dispatches",
    "audit_events",
  ])
    expect(inserts).toContain("INSERT INTO public." + name + "(");
  const session = db.calls.find(([sql]) =>
    sql.includes("FROM public.upload_sessions"),
  );
  expect(session[1]).toEqual([[id], id, actor.accountId, id, "test"]);
  expect(session[0]).toContain("expires_at>statement_timestamp()");
  const writes = db.state.writes.length;
  expect((await service.send(actor, cmd)).result).toMatchObject({
    kind: "sent",
    replayed: true,
  });
  expect(db.state.writes).toHaveLength(writes);
  expect(
    (await service.send(actor, { ...cmd, body: "Altered" })).result.kind,
  ).toBe("conflict");
});
test("text-only permitted while attachment path remains fail closed", async () => {
  const db = fixture(),
    service = createMessageSubmissionService(db);
  expect((await service.send(actor, command)).result.kind).toBe("sent");
  const next = { ...command, idempotency_key: foreign, file_ids: [id] };
  expect((await service.send(actor, next)).result).toMatchObject({
    kind: "files_not_ready",
    persisted: false,
  });
  expect(db.state.seq).toBe(1);
});
test("clinic, current grants, closed conversation and invalid body refuse without writes", async () => {
  for (const patch of [
    { revoked: true },
    { suspended: true },
    { unapproved: true },
    { foreign: true },
  ]) {
    const db = fixture(patch);
    expect(
      (await createMessageSubmissionService(db).send(actor, command)).kind,
    ).toBe("denied");
    expect(db.state.writes).toEqual([]);
  }
  for (const patch of [
    { profile: "employee" },
    { profile: "employee", grants: ["messaging.order.read"] },
    {
      profile: "employee",
      kind: "general",
      grants: ["messaging.order.read", "messaging.order.reply"],
    },
    {
      profile: "employee",
      grants: [
        "orders.read_logistics",
        "messaging.order.read",
        "messaging.order.reply",
      ],
    },
  ]) {
    const db = fixture(patch);
    const cmd = { ...command, file_ids: [id] };
    const result = await createMessageSubmissionService(db, policy).send(
      actor,
      cmd,
    );
    expect(
      result.kind === "denied" || result.result?.kind === "files_not_ready",
    ).toBe(true);
    expect(db.state.writes).toEqual([]);
  }
  const lab = fixture({
    profile: "employee",
    grants: [
      "orders.read_logistics",
      "messaging.order.read",
      "messaging.order.reply",
    ],
  });
  expect(
    (await createMessageSubmissionService(lab).send(actor, command)).result
      .kind,
  ).toBe("sent");
  const closed = fixture({ closed: true });
  expect(
    (await createMessageSubmissionService(closed).send(actor, command)).result
      .kind,
  ).toBe("conversation_closed");
  const invalid = fixture();
  for (const value of [
    { ...command, body: null },
    { ...command, clinic_id: id },
    { ...command, body: "" },
  ])
    expect(
      (await createMessageSubmissionService(invalid).send(actor, value)).kind,
    ).toBe("invalid");
  expect(invalid.transaction).not.toHaveBeenCalled();
});
test("wrong owner/clinic, corrupt or expired evidence, duplicate binding and oversized batch refuse", async () => {
  const cmd = { ...command, file_ids: [id] };
  for (const patch of [
    { files: [{ ...file, clinic_id: foreign }] },
    { files: [{ ...file, created_by: foreign }] },
    { files: [{ ...file, state: "quarantined" }] },
    { files: [{ ...file, content_sha256: null }] },
    { files: [{ ...file, size_bytes: "200000001" }] },
    { uploads: [] },
    { uploads: [{ ...upload, received_bytes: "2" }] },
    { bound: true },
  ]) {
    const db = fixture({ files: [file], uploads: [upload], ...patch });
    expect(
      (await createMessageSubmissionService(db, policy).send(actor, cmd)).result
        .kind,
    ).toBe("files_not_ready");
    expect(db.state.writes).toEqual([]);
  }
});
test("concurrent key replay and failures at every write roll back all aggregate state in double", async () => {
  const db = fixture(),
    service = createMessageSubmissionService(db);
  const both = await Promise.all([
    service.send(actor, command),
    service.send(actor, command),
  ]);
  expect(both.map((x) => x.result.replayed)).toEqual([false, true]);
  expect(db.state.seq).toBe(1);
  const cmd = { ...command, file_ids: [id] };
  for (const patch of [
    { expiredAtAttach: true },
    { closedAtInsert: true },
    { failAt: "public.message_versions(" },
    { failAt: "public.message_version_files(" },
    { failAt: "public.file_events(" },
    { failAt: "public.audit_events(" },
    { commitFailure: true },
  ]) {
    const failing = fixture({ files: [file], uploads: [upload], ...patch });
    await expect(
      createMessageSubmissionService(failing, policy).send(actor, cmd),
    ).rejects.toThrow();
    expect(failing.state.writes).toEqual([]);
    expect(failing.state.seq).toBe(0);
  }
});
