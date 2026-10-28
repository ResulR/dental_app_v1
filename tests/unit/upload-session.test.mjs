import { test, expect } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, chmod, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { createPrivateChunkStore } from "../../apps/api/src/modules/files/private-chunks.ts";
import { createUploadSessionController } from "../../apps/api/src/modules/files/upload-session.repository.ts";
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
  let state = { session: null, chunks: new Map(), file: null };
  let queue = Promise.resolve();
  const transaction = (fn) => {
    const task = queue.then(async () => {
      const draft = {
        session: state.session && { ...state.session },
        chunks: new Map(state.chunks),
        file: state.file && { ...state.file },
      };
      const query = async (sql, v = []) => {
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
          return { rows: [{ total: "0" }] };
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
        if (sql.startsWith("INSERT INTO public.upload_sessions")) {
          draft.session = {
            id: v[0],
            clinic_id: v[2],
            declared_size: String(v[3]),
            chunk_size: String(v[4]),
            received_bytes: "0",
            revision: "1",
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
