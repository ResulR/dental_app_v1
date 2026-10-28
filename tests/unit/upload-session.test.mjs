import { test, expect } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, chmod, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { createPrivateChunkStore } from "../../apps/api/src/modules/files/private-chunks.ts";
import { createUploadSessionController } from "../../apps/api/src/modules/files/upload-session.repository.ts";
import { prepareNewOrderFiles } from "../../apps/api/src/modules/files/attachment.repository.ts";
const hash = (v) => createHash("sha256").update(v).digest("hex");
const actor = { accountId: randomUUID(), sessionId: randomUUID() };
const clinicId = randomUUID();
const policy = (root) => ({
  privateRoot: root,
  chunkSize: 3,
  maxSegments: 3,
  ttlSeconds: 60,
  maxReservedBytes: 1000,
  minimumFreeBytes: 1,
  capacityPolicyVersion: "synthetic-1",
  storagePolicyVersion: "synthetic-1",
});
const source = async function* (v) {
  yield Buffer.from(v);
};
function database(patch = {}) {
  let state = { session: null, chunks: new Map(), file: null, events: [] };
  let queue = Promise.resolve();
  const transaction = (fn) => {
    const task = queue.then(async () => {
      const draft = {
        session: state.session && { ...state.session },
        chunks: new Map(state.chunks),
        file: state.file && { ...state.file },
        events: [...state.events],
      };
      const query = async (sql, v = []) => {
        if (sql.startsWith("SELECT s.id,s.declared_size::text"))
          return {
            rows:
              draft.session &&
              draft.session.file_id === null &&
              ((patch.expired &&
                ["initialized", "receiving"].includes(draft.session.state)) ||
                (draft.session.state === "aborted" &&
                  draft.events.includes("cleanup_claimed") &&
                  !draft.events.includes("cleanup_completed")))
                ? [draft.session]
                : [],
          };
        if (sql.includes("SET state='aborted',reserved_bytes=0")) {
          draft.session.state = "aborted";
          draft.session.reserved_bytes = "0";
          return { rows: [{ id: draft.session.id }] };
        }
        if (sql.startsWith("INSERT INTO public.file_events")) {
          const action = sql.includes("cleanup_claimed")
            ? "cleanup_claimed"
            : sql.includes("cleanup_completed")
              ? "cleanup_completed"
              : sql.includes("'structure_probe'")
                ? v[1]
                : sql.includes("'aborted'")
                  ? "aborted"
                  : "assembled_private";
          draft.events.push(action);
          return { rows: [] };
        }
        if (
          sql.startsWith("SELECT id FROM public.file_events WHERE upload_id=$1")
        )
          return {
            rows: draft.events.includes("cleanup_claimed")
              ? [{ id: randomUUID() }]
              : [],
          };
        if (
          sql.startsWith(
            "SELECT declared_size::text,chunk_size::text FROM public.upload_sessions",
          )
        )
          return {
            rows:
              draft.session?.state === "aborted" &&
              draft.session.file_id === null &&
              draft.events.includes("cleanup_completed")
                ? [draft.session]
                : [],
          };
        if (sql.startsWith("SELECT action FROM public.file_events"))
          return { rows: draft.events.map((action) => ({ action })) };
        if (
          sql.startsWith(
            "SELECT id FROM public.upload_sessions WHERE id=$1 AND state='aborted'",
          )
        )
          return {
            rows:
              draft.session?.state === "aborted" &&
              draft.session?.file_id === null
                ? [{ id: v[0] }]
                : [],
          };
        if (sql.startsWith("SELECT a.profile"))
          return {
            rows: [
              {
                profile: "clinic",
                lifecycle: "active",
                sessionValid: true,
                securityLocked: false,
                resetRequired: false,
                ownerCurrent: false,
                clinicId,
                clinicSuspended: false,
                grants: [],
              },
            ],
          };
        if (
          sql.startsWith(
            "SELECT id FROM public.clinics WHERE account_id=$1 AND",
          )
        )
          return { rows: patch.foreign ? [] : [{ id: clinicId }] };
        if (sql.startsWith("SELECT COALESCE(sum(reserved_bytes)"))
          return {
            rows: [
              {
                total:
                  draft.session &&
                  ["initialized", "receiving", "verifying", "ready"].includes(
                    draft.session.state,
                  )
                    ? draft.session.reserved_bytes
                    : "0",
              },
            ],
          };
        if (sql.startsWith("SELECT clinic_id,declared_size::text"))
          return {
            rows:
              (patch.expired && draft.session?.state !== "verifying") ||
              !draft.session ||
              v[0] !== draft.session.id ||
              v[1] !== actor.accountId ||
              v[2] !== clinicId
                ? []
                : [draft.session],
          };
        if (sql.startsWith("SELECT segment_index AS index"))
          return {
            rows: [...draft.chunks.entries()]
              .sort(([a], [b]) => a - b)
              .map(([index, item]) => ({
                index,
                size_bytes: String(item.sizeBytes),
                sha256: item.sha256,
              })),
          };
        if (sql.startsWith("SELECT size_bytes::text"))
          return {
            rows: draft.chunks.has(v[1])
              ? [
                  {
                    size_bytes: String(draft.chunks.get(v[1]).sizeBytes),
                    sha256: draft.chunks.get(v[1]).sha256,
                  },
                ]
              : [],
          };
        if (sql.startsWith("SELECT object_key"))
          return { rows: draft.file ? [draft.file] : [] };
        if (sql.startsWith("SELECT id FROM public.file_objects WHERE id=$1"))
          return {
            rows:
              draft.file?.state === "verifying" &&
              draft.file?.object_key === v[2]
                ? [{ id: v[0] }]
                : [],
          };
        if (
          sql.startsWith(
            "SELECT id,clinic_id,created_by,state,size_bytes::text",
          )
        )
          return {
            rows: draft.file
              ? [
                  {
                    ...draft.file,
                    id: draft.session.file_id,
                    clinic_id: clinicId,
                    created_by: actor.accountId,
                    content_sha256: Buffer.from(draft.file.sha256, "hex"),
                    storage_policy_version: "synthetic-1",
                    verified_at: null,
                    media_type_verified: null,
                  },
                ]
              : [],
          };
        if (sql.startsWith("INSERT INTO public.upload_sessions")) {
          draft.session = {
            id: v[0],
            clinic_id: v[2],
            declared_size: String(v[3]),
            chunk_size: String(v[4]),
            received_bytes: "0",
            revision: "1",
            reserved_bytes: String(v[3] * 2),
            state: "initialized",
            file_id: null,
          };
          return { rows: [] };
        }
        if (sql.startsWith("INSERT INTO public.upload_chunks")) {
          draft.chunks.set(v[4], { sizeBytes: v[5], sha256: v[6] });
          return { rows: [] };
        }
        if (
          sql.startsWith("UPDATE public.upload_sessions") &&
          sql.includes("SET state='receiving'")
        ) {
          draft.session.state = "receiving";
          draft.session.received_bytes = String(
            Number(draft.session.received_bytes) + v[1],
          );
          draft.session.revision = String(Number(draft.session.revision) + 1);
          return { rows: [{ id: draft.session.id }] };
        }
        if (
          sql.startsWith("UPDATE public.upload_sessions") &&
          sql.includes("SET state='verifying'")
        ) {
          draft.session.state = "verifying";
          draft.session.revision = String(Number(draft.session.revision) + 1);
          return { rows: [{ id: draft.session.id }] };
        }
        if (sql.startsWith("INSERT INTO public.file_objects")) {
          draft.file = {
            object_key: v[3],
            size_bytes: String(v[6]),
            sha256: v[7],
            state: "verifying",
            filename_original: v[4],
            format: v[5],
          };
          return { rows: [] };
        }
        if (
          sql.startsWith("UPDATE public.upload_sessions") &&
          sql.includes("SET file_id")
        ) {
          draft.session.file_id = v[1];
          return { rows: [{ id: draft.session.id }] };
        }
        return { rows: [] };
      };
      const result = await fn({ query });
      state = draft;
      return result;
    });
    queue = task.catch(() => {});
    return task;
  };
  return {
    transaction,
    get state() {
      return state;
    },
  };
}
async function fixture(run, patch = {}) {
  const root = await mkdtemp(
    path.join(process.cwd(), ".local", "dental-session-synthetic-"),
  );
  try {
    await chmod(root, 0o700);
    for (const name of ["chunks", "objects", "quarantine"])
      await mkdir(path.join(root, name), { mode: 0o700 });
    const db = database(patch),
      store = await createPrivateChunkStore(root, [path.join(root, "public")]);
    return await run({
      root,
      db,
      controller: createUploadSessionController(db, store, policy(root)),
      store,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test("clinic opens, resumes from SQL receipts, assembles privately, and reconciles lost response", async () => {
  const flags = { expired: false };
  return fixture(async ({ root, db, controller }) => {
    const opened = await controller.open(actor, 6),
      id = opened.uploadId,
      signal = new globalThis.AbortController().signal;
    expect(opened.kind).toBe("opened");
    expect(
      (
        await controller.receive(
          actor,
          id,
          0,
          hash("abc"),
          source("abc"),
          signal,
        )
      ).repeated,
    ).toBe(false);
    expect(await controller.progress(actor, id)).toMatchObject({
      missing: [1],
      receivedBytes: 3,
      complete: false,
    });
    const never = {
      [Symbol.asyncIterator]() {
        throw new Error("retransmitted");
      },
    };
    expect(
      (await controller.receive(actor, id, 0, hash("abc"), never, signal))
        .repeated,
    ).toBe(true);
    expect(
      (
        await controller.finalize(
          actor,
          id,
          hash("abcdef"),
          "synthetic.stl",
          "stl",
        )
      ).kind,
    ).toBe("incomplete");
    await controller.receive(actor, id, 1, hash("def"), source("def"), signal);
    const result = await controller.finalize(
      actor,
      id,
      hash("abcdef"),
      "synthetic.stl",
      "stl",
    );
    expect(result).toMatchObject({
      kind: "awaiting_inspection",
      repeated: false,
    });
    expect(db.state.session.state).toBe("verifying");
    expect(db.state.file.state).toBe("verifying");
    expect(await readdir(path.join(root, "objects"))).toHaveLength(1);
    expect(
      await controller.finalize(
        actor,
        id,
        hash("abcdef"),
        "synthetic.stl",
        "stl",
      ),
    ).toMatchObject({
      kind: "awaiting_inspection",
      fileId: result.fileId,
      repeated: true,
    });
    expect(await readdir(path.join(root, "objects"))).toHaveLength(1);
    expect(
      (
        await controller.finalize(
          actor,
          id,
          hash("abcdef"),
          "different.stl",
          "stl",
        )
      ).kind,
    ).toBe("conflict");
    flags.expired = true;
    expect(
      (
        await controller.finalize(
          actor,
          id,
          hash("abcdef"),
          "synthetic.stl",
          "stl",
        )
      ).repeated,
    ).toBe(true);
  }, flags);
});
test("foreign clinic, expiry, conflicting fragment and bad final hash fail closed", async () =>
  fixture(async ({ root, db, controller }) => {
    const id = (await controller.open(actor, 3)).uploadId,
      signal = new globalThis.AbortController().signal;
    await expect(
      controller.receive(actor, id, 0, hash("xyz"), source("abc"), signal),
    ).rejects.toThrow();
    expect(db.state.chunks.size).toBe(0);
    await controller.receive(actor, id, 0, hash("abc"), source("abc"), signal);
    await expect(
      controller.receive(actor, id, 0, hash("xyz"), source("xyz"), signal),
    ).rejects.toThrow();
    await expect(
      controller.finalize(actor, id, hash("wrong"), "synthetic.obj", "obj"),
    ).rejects.toThrow();
    expect(
      (
        await controller.finalize(
          actor,
          id,
          hash("abc"),
          "synthetic.obj",
          "obj",
        )
      ).kind,
    ).toBe("reconciliation_required");
    expect(db.state.file).toBeNull();
    expect(
      (
        await createUploadSessionController(
          database({ foreign: true }),
          await createPrivateChunkStore(root, [path.join(root, "public")]),
          policy(root),
        ).open(actor, 3)
      ).kind,
    ).toBe("denied");
    const expired = database({ expired: true });
    expect(
      (
        await createUploadSessionController(
          expired,
          await createPrivateChunkStore(root, [path.join(root, "public")]),
          policy(root),
        ).progress(actor, id)
      ).kind,
    ).toBe("denied");
  }));
test("serialized admission double accepts at most one reservation within explicit budget", async () => {
  const root = await mkdtemp(
    path.join(process.cwd(), ".local", "dental-capacity-synthetic-"),
  );
  try {
    await chmod(root, 0o700);
    for (const name of ["chunks", "objects", "quarantine"])
      await mkdir(path.join(root, name), { mode: 0o700 });
    const store = await createPrivateChunkStore(root, [
      path.join(root, "public"),
    ]);
    let reserved = 0,
      queue = Promise.resolve();
    const db = {
      transaction(fn) {
        const task = queue.then(() =>
          fn({
            query: async (sql) => {
              if (sql.startsWith("SELECT a.profile"))
                return {
                  rows: [
                    {
                      profile: "clinic",
                      lifecycle: "active",
                      sessionValid: true,
                      securityLocked: false,
                      resetRequired: false,
                      ownerCurrent: false,
                      clinicId,
                      clinicSuspended: false,
                      grants: [],
                    },
                  ],
                };
              if (
                sql.startsWith(
                  "SELECT id FROM public.clinics WHERE account_id=$1 AND",
                )
              )
                return { rows: [{ id: clinicId }] };
              if (sql.startsWith("SELECT COALESCE(sum(reserved_bytes)"))
                return { rows: [{ total: String(reserved) }] };
              if (sql.startsWith("INSERT INTO public.upload_sessions"))
                reserved += 12;
              return { rows: [] };
            },
          }),
        );
        queue = task.catch(() => {});
        return task;
      },
    };
    const controller = createUploadSessionController(db, store, {
      ...policy(root),
      maxReservedBytes: 12,
    });
    const outcomes = await Promise.all([
      controller.open(actor, 6),
      controller.open(actor, 6),
    ]);
    expect(outcomes.map((r) => r.kind).sort()).toEqual(["capacity", "opened"]);
    expect(reserved).toBe(12);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("expired unfinished upload is claimed and cleaned once; failed removal resumes", async () => {
  const flags = { expired: false };
  return fixture(async ({ root, db, store, controller }) => {
    const id = (await controller.open(actor, 6)).uploadId;
    await controller.receive(
      actor,
      id,
      0,
      hash("abc"),
      source("abc"),
      new globalThis.AbortController().signal,
    );
    // Deliberately sealed without a SQL receipt: interrupted request.
    await store.put(
      id,
      { index: 1, sizeBytes: 3, sha256: hash("def") },
      source("def"),
      new globalThis.AbortController().signal,
      3,
    );
    expect(db.state.chunks.size).toBe(1);
    expect(await readdir(path.join(root, "chunks"))).toHaveLength(2);
    flags.expired = true;
    const constrained = createUploadSessionController(db, store, {
      ...policy(root),
      maxReservedBytes: 12,
    });
    expect((await constrained.open(actor, 6)).kind).toBe("capacity");
    let fail = true;
    const interrupted = createUploadSessionController(
      db,
      {
        ...store,
        discard: async (...args) => {
          if (fail) {
            fail = false;
            throw new Error("interrupted");
          }
          return store.discard(...args);
        },
      },
      policy(root),
    );
    expect(await interrupted.cleanupExpired(1)).toEqual([
      { uploadId: id, kind: "retry" },
    ]);
    expect(db.state.session.state).toBe("aborted");
    expect(db.state.session.reserved_bytes).toBe("0");
    expect(db.state.events).toContain("cleanup_claimed");
    expect(db.state.events).not.toContain("cleanup_completed");
    expect(
      (
        await Promise.all([
          controller.cleanupExpired(1),
          controller.cleanupExpired(1),
        ])
      ).flat(),
    ).toEqual([{ uploadId: id, kind: "cleaned" }]);
    expect(await readdir(path.join(root, "chunks"))).toHaveLength(0);
    expect(db.state.chunks.size).toBe(1); // audit receipt is retained
    expect(await controller.cleanupExpired(1)).toEqual([]);
    expect(
      db.state.events.filter((e) => e === "cleanup_completed"),
    ).toHaveLength(1);
  }, flags);
});

test("owner abort releases reservation once and retains receipt audit until targeted removal", async () =>
  fixture(async ({ root, db, controller }) => {
    const id = (await controller.open(actor, 3)).uploadId;
    await controller.receive(
      actor,
      id,
      0,
      hash("abc"),
      source("abc"),
      new globalThis.AbortController().signal,
    );
    expect(await controller.abort(actor, id)).toEqual({
      kind: "aborted",
      repeated: false,
    });
    expect(await controller.abort(actor, id)).toEqual({
      kind: "aborted",
      repeated: true,
    });
    expect(db.state.session.reserved_bytes).toBe("0");
    expect(db.state.events.filter((e) => e === "cleanup_claimed")).toHaveLength(
      1,
    );
    expect(
      (
        await controller.receive(
          actor,
          id,
          0,
          hash("abc"),
          source("abc"),
          new globalThis.AbortController().signal,
        )
      ).kind,
    ).toBe("conflict");
    expect(await controller.cleanupExpired(1)).toEqual([
      { uploadId: id, kind: "cleaned" },
    ]);
    expect(await readdir(path.join(root, "chunks"))).toHaveLength(0);
  }));

test("a fragment sealed after a concurrent cleanup claim is removed before rejecting its receipt", async () =>
  fixture(async ({ root, db, store, controller }) => {
    const id = (await controller.open(actor, 3)).uploadId;
    const racing = createUploadSessionController(
      db,
      {
        ...store,
        put: async (...args) => {
          await controller.abort(actor, id);
          await controller.cleanupExpired(1);
          await store.put(...args);
        },
      },
      policy(root),
    );
    expect(
      (
        await racing.receive(
          actor,
          id,
          0,
          hash("abc"),
          source("abc"),
          new globalThis.AbortController().signal,
        )
      ).kind,
    ).toBe("conflict");
    expect(await readdir(path.join(root, "chunks"))).toHaveLength(0);
    expect(db.state.chunks.size).toBe(0);
  }));

test("real private transfer assembles, inspects STL and refuses business attachment without qualified scan", async () =>
  fixture(async ({ db, store, root }) => {
    const controller = createUploadSessionController(db, store, {
      ...policy(root),
      chunkSize: 134,
      maxSegments: 2,
    });
    const stl = Buffer.alloc(134);
    stl.writeUInt32LE(1, 80);
    stl.writeFloatLE(1, 96);
    stl.writeFloatLE(1, 108);
    const id = (await controller.open(actor, stl.length)).uploadId;
    expect((await controller.progress(actor, id)).missing).toEqual([0]);
    expect(
      (
        await controller.receive(
          actor,
          id,
          0,
          hash(stl),
          source(stl),
          new globalThis.AbortController().signal,
        )
      ).kind,
    ).toBe("received");
    expect((await controller.progress(actor, id)).complete).toBe(true);
    expect(
      (await controller.finalize(actor, id, hash(stl), "synthetic.stl", "stl"))
        .kind,
    ).toBe("awaiting_inspection");
    expect(await controller.inspect(actor, id)).toEqual({
      kind: "quarantined",
      structure: "candidate",
      validation: "blocked",
    });
    expect(db.state.session.state).toBe("verifying");
    expect(db.state.file.state).toBe("verifying");
    expect(db.state.events).toContain("candidate");
    const attachment = await prepareNewOrderFiles(
      {
        query: async (sql, args) => db.transaction((tx) => tx.query(sql, args)),
      },
      {
        actorId: actor.accountId,
        clinicId,
        fileIds: [db.state.session.file_id],
        purpose: "initial_order",
        sourceOrderId: null,
      },
      {
        storagePolicyVersion: "synthetic-1",
        capacityPolicyVersion: "synthetic-1",
      },
    );
    expect(attachment).toBeNull();
  }));
