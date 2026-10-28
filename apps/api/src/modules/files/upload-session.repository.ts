import { randomUUID } from "node:crypto";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import { uploadClinicAuthority } from "./upload-auth.js";
import { assertFileSize } from "./transfer-limits.js";
import { uploadProgress } from "./upload-progress.js";
import { requireDiskHeadroom } from "./disk-headroom.js";
import type { createPrivateChunkStore } from "./private-chunks.js";
import type { FileFormat } from "./format-probe.js";
import type { createValidationEvidence } from "./validation-evidence.js";

type Actor = { accountId: string; sessionId: string };
type Store = Awaited<ReturnType<typeof createPrivateChunkStore>>;
type Policy = {
  privateRoot: string;
  chunkSize: number;
  maxSegments: number;
  ttlSeconds: number;
  maxReservedBytes: number;
  minimumFreeBytes: number;
  capacityPolicyVersion: string;
  storagePolicyVersion: string;
};
type Session = {
  clinic_id: string;
  declared_size: string;
  chunk_size: string;
  received_bytes: string;
  revision: string;
  state: string;
  file_id: string | null;
};
const sha = /^[0-9a-f]{64}$/;
function assertPolicy(p: Policy) {
  if (
    ![
      p.chunkSize,
      p.maxSegments,
      p.ttlSeconds,
      p.maxReservedBytes,
      p.minimumFreeBytes,
    ].every((n) => Number.isSafeInteger(n) && n > 0) ||
    p.maxSegments > 10000 ||
    !p.privateRoot ||
    !p.capacityPolicyVersion?.trim() ||
    !p.storagePolicyVersion?.trim()
  )
    throw new Error("UPLOAD_SESSION_POLICY_REQUIRED");
}
async function clinic(tx: DatabaseExecutor, actor: Actor) {
  return uploadClinicAuthority(tx, actor);
}
async function load(
  tx: DatabaseExecutor,
  actor: Actor,
  id: string,
  lock: "FOR SHARE" | "FOR UPDATE",
) {
  const clinicId = await clinic(tx, actor);
  if (!clinicId) return null;
  const r = await tx.query<Session>(
    `SELECT clinic_id,declared_size::text,chunk_size::text,
    received_bytes::text,revision::text,state,file_id FROM public.upload_sessions
    WHERE id=$1 AND account_id=$2 AND clinic_id=$3 AND intended_kind='initial_order'
      AND intended_order_id IS NULL AND intended_conversation_id IS NULL
      AND (expires_at>statement_timestamp() OR state IN ('verifying','aborted')) ${lock}`,
    [id, actor.accountId, clinicId],
  );
  return r.rows.length === 1 ? r.rows[0]! : null;
}
async function parts(tx: DatabaseExecutor, id: string) {
  const r = await tx.query(
    "SELECT segment_index AS index,size_bytes::text,encode(sha256,'hex') AS sha256 FROM public.upload_chunks WHERE upload_id=$1 ORDER BY segment_index",
    [id],
  );
  return r.rows.map((v) => ({
    index: Number(v.index),
    sizeBytes: Number(v.size_bytes),
    sha256: v.sha256 as string,
  }));
}
// Prepared controller for clinic initial-order uploads only. No runtime route.
export function createUploadSessionController(
  db: Pick<ReturnType<typeof createApplicationDatabase>, "transaction">,
  store: Store,
  policy: Policy,
  validation?: ReturnType<typeof createValidationEvidence>,
) {
  assertPolicy(policy);
  if (
    !store ||
    typeof store.put !== "function" ||
    typeof store.assemble !== "function"
  )
    throw new Error("UPLOAD_STORAGE_REQUIRED");
  return {
    // Explicit operator reconciliation for bytes linked after a cleanup finished
    // but before an interrupted receiver could obtain its terminal SQL verdict.
    async reconcileCleaned(id: string) {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id,
        )
      )
        return { kind: "denied" as const };
      return db.transaction(async (tx) => {
        const rows = await tx.query<{
          declared_size: string;
          chunk_size: string;
        }>(
          `SELECT declared_size::text,chunk_size::text FROM public.upload_sessions
           WHERE id=$1 AND intended_kind='initial_order' AND state='aborted'
             AND file_id IS NULL AND intended_order_id IS NULL
             AND intended_conversation_id IS NULL AND reserved_bytes=0 FOR UPDATE`,
          [id],
        );
        if (rows.rows.length !== 1) return { kind: "denied" as const };
        const audit = await tx.query(
          "SELECT action FROM public.file_events WHERE upload_id=$1 AND process_code='upload_cleanup' AND action IN ('cleanup_claimed','cleanup_completed')",
          [id],
        );
        const actions = new Set(audit.rows.map((event) => event.action));
        if (
          !actions.has("cleanup_claimed") ||
          !actions.has("cleanup_completed")
        )
          return { kind: "denied" as const };
        const count = Math.ceil(
          Number(rows.rows[0]!.declared_size) /
            Number(rows.rows[0]!.chunk_size),
        );
        if (
          !Number.isSafeInteger(count) ||
          count < 1 ||
          count > policy.maxSegments
        )
          throw new Error("UPLOAD_CLEANUP_INCONSISTENT");
        await store.discard(id, count);
        return { kind: "rechecked" as const };
      });
    },
    // Operator-only entry point: no route or automatic worker. A claim is terminal
    // for the upload, so a concurrent receive can no longer publish a receipt.
    async cleanupExpired(limit: number) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
        throw new Error("UPLOAD_CLEANUP_LIMIT");
      const results: Array<{ uploadId: string; kind: "cleaned" | "retry" }> =
        [];
      for (let iteration = 0; iteration < limit; iteration++) {
        const claim = await db.transaction(async (tx) => {
          const found = await tx.query<{
            id: string;
            declared_size: string;
            chunk_size: string;
            state: string;
          }>(
            `SELECT s.id,s.declared_size::text,s.chunk_size::text,s.state
             FROM public.upload_sessions s
             WHERE s.intended_kind='initial_order' AND s.file_id IS NULL
               AND s.intended_order_id IS NULL AND s.intended_conversation_id IS NULL
               AND ((s.state IN ('initialized','receiving') AND s.expires_at<=statement_timestamp())
                 OR (s.state='aborted' AND EXISTS (
                   SELECT 1 FROM public.file_events e WHERE e.upload_id=s.id
                     AND e.process_code='upload_cleanup' AND e.action='cleanup_claimed')
                   AND NOT EXISTS (
                   SELECT 1 FROM public.file_events e WHERE e.upload_id=s.id
                     AND e.process_code='upload_cleanup' AND e.action='cleanup_completed')))
             ORDER BY s.created_at,s.id FOR UPDATE OF s SKIP LOCKED LIMIT 1`,
          );
          const row = found.rows[0];
          if (!row) return null;
          const count = Math.ceil(
            Number(row.declared_size) / Number(row.chunk_size),
          );
          if (
            !Number.isSafeInteger(count) ||
            count < 1 ||
            count > policy.maxSegments
          )
            throw new Error("UPLOAD_CLEANUP_INCONSISTENT");
          if (row.state !== "aborted") {
            await tx.query(
              `UPDATE public.upload_sessions SET state='aborted',reserved_bytes=0,
               revision=revision+1 WHERE id=$1 AND state IN ('initialized','receiving')
               AND file_id IS NULL AND expires_at<=statement_timestamp()`,
              [row.id],
            );
            await tx.query(
              "INSERT INTO public.file_events(upload_id,process_code,action) VALUES($1,'upload_cleanup','cleanup_claimed')",
              [row.id],
            );
          }
          return { uploadId: row.id, count };
        });
        if (!claim) break;
        try {
          const completed = await db.transaction(async (tx) => {
            const row = await tx.query(
              `SELECT id FROM public.upload_sessions WHERE id=$1 AND state='aborted'
               AND file_id IS NULL AND reserved_bytes=0 FOR UPDATE`,
              [claim.uploadId],
            );
            if (row.rows.length !== 1)
              throw new Error("UPLOAD_CLEANUP_CONFLICT");
            const audit = await tx.query(
              `SELECT action FROM public.file_events WHERE upload_id=$1
               AND process_code='upload_cleanup' AND action IN ('cleanup_claimed','cleanup_completed')`,
              [claim.uploadId],
            );
            const actions = new Set(audit.rows.map((event) => event.action));
            if (!actions.has("cleanup_claimed"))
              throw new Error("UPLOAD_CLEANUP_CONFLICT");
            if (actions.has("cleanup_completed")) return false;
            // Hold the terminal session row lock through physical removal so
            // another cleaner cannot record a second completion.
            await store.discard(claim.uploadId, claim.count);
            await tx.query(
              "INSERT INTO public.file_events(upload_id,process_code,action) VALUES($1,'upload_cleanup','cleanup_completed')",
              [claim.uploadId],
            );
            return true;
          });
          if (completed)
            results.push({ uploadId: claim.uploadId, kind: "cleaned" });
        } catch {
          // The claim and audit remain durable for an explicit subsequent retry.
          results.push({ uploadId: claim.uploadId, kind: "retry" });
          break;
        }
      }
      return results;
    },
    async open(actor: Actor, declaredSize: number) {
      assertFileSize(declaredSize);
      // Authorization precedes even the disk-capacity response.
      if (!(await db.transaction((tx) => clinic(tx, actor))))
        return { kind: "denied" as const };
      const count = Math.ceil(declaredSize / policy.chunkSize);
      const reserved = declaredSize * 2; // Chunks plus assembled original.
      if (
        count > policy.maxSegments ||
        !Number.isSafeInteger(reserved) ||
        reserved > policy.maxReservedBytes
      )
        return { kind: "capacity" as const };
      if (
        (
          await requireDiskHeadroom(
            policy.privateRoot,
            reserved,
            policy.minimumFreeBytes,
          )
        ).kind !== "admissible"
      )
        return { kind: "capacity" as const };
      return db.transaction(async (tx) => {
        const clinicId = await clinic(tx, actor);
        if (!clinicId) return { kind: "denied" as const };
        await tx.query(
          "LOCK TABLE public.upload_sessions IN SHARE ROW EXCLUSIVE MODE",
        );
        const used = await tx.query(
          "SELECT COALESCE(sum(reserved_bytes),0)::text AS total FROM public.upload_sessions WHERE state IN ('initialized','receiving','verifying','ready')",
        );
        const total = Number(used.rows[0]?.total);
        if (
          !Number.isSafeInteger(total) ||
          total > policy.maxReservedBytes - reserved
        )
          return { kind: "capacity" as const };
        const uploadId = randomUUID();
        await tx.query(
          `INSERT INTO public.upload_sessions
          (id,account_id,clinic_id,intended_kind,declared_size,chunk_size,expires_at,capacity_policy_version,reserved_bytes)
          VALUES($1,$2,$3,'initial_order',$4,$5,statement_timestamp()+($6::integer*interval '1 second'),$7,$8)`,
          [
            uploadId,
            actor.accountId,
            clinicId,
            declaredSize,
            policy.chunkSize,
            policy.ttlSeconds,
            policy.capacityPolicyVersion,
            reserved,
          ],
        );
        return {
          kind: "opened" as const,
          uploadId,
          chunkSize: policy.chunkSize,
          segments: count,
        };
      });
    },
    async abort(actor: Actor, id: string) {
      return db.transaction(async (tx) => {
        const row = await load(tx, actor, id, "FOR UPDATE");
        if (!row) return { kind: "denied" as const };
        if (row.state === "aborted")
          return { kind: "aborted" as const, repeated: true };
        if (!["initialized", "receiving"].includes(row.state) || row.file_id)
          return { kind: "conflict" as const };
        const updated = await tx.query(
          `UPDATE public.upload_sessions SET state='aborted',reserved_bytes=0,
           revision=revision+1 WHERE id=$1 AND revision=$2
           AND state IN ('initialized','receiving') AND file_id IS NULL
           AND expires_at>statement_timestamp() RETURNING id`,
          [id, row.revision],
        );
        if (updated.rows.length !== 1) throw new Error("UPLOAD_ABORT_CONFLICT");
        await tx.query(
          "INSERT INTO public.file_events(upload_id,actor_id,action) VALUES($1,$2,'aborted')",
          [id, actor.accountId],
        );
        await tx.query(
          "INSERT INTO public.file_events(upload_id,process_code,action) VALUES($1,'upload_cleanup','cleanup_claimed')",
          [id],
        );
        return { kind: "aborted" as const, repeated: false };
      });
    },
    async progress(actor: Actor, id: string) {
      return db.transaction(async (tx) => {
        const row = await load(tx, actor, id, "FOR SHARE");
        if (!row) return { kind: "denied" as const };
        const status = uploadProgress(
          Number(row.declared_size),
          Number(row.chunk_size),
          await parts(tx, id),
          policy.maxSegments,
        );
        if (status.receivedBytes !== Number(row.received_bytes))
          throw new Error("UPLOAD_RECEIPT_INCONSISTENT");
        return {
          kind: "result" as const,
          state: row.state,
          revision: Number(row.revision),
          ...status,
        };
      });
    },
    async receive(
      actor: Actor,
      id: string,
      index: number,
      expected: string,
      source: AsyncIterable<Uint8Array>,
      signal: AbortSignal,
    ) {
      if (!Number.isInteger(index) || index < 0 || !sha.test(expected))
        return { kind: "invalid" as const };
      const before = await db.transaction(async (tx) => {
        const row = await load(tx, actor, id, "FOR SHARE");
        if (!row) return { kind: "denied" as const };
        if (!["initialized", "receiving"].includes(row.state))
          return { kind: "conflict" as const };
        const size = Number(row.declared_size),
          chunkSize = Number(row.chunk_size);
        if (
          chunkSize !== policy.chunkSize ||
          Math.ceil(size / chunkSize) > policy.maxSegments ||
          index >= Math.ceil(size / chunkSize)
        )
          return { kind: "invalid" as const };
        return {
          kind: "allowed" as const,
          sizeBytes: Math.min(chunkSize, size - index * chunkSize),
          chunkSize,
        };
      });
      if (before.kind !== "allowed") return before;
      // No DB lock is held over the stream. The private link is exclusive.
      await store.put(
        id,
        { index, sizeBytes: before.sizeBytes, sha256: expected },
        source,
        signal,
        before.chunkSize,
      );
      return db.transaction(async (tx) => {
        const row = await load(tx, actor, id, "FOR UPDATE");
        if (!row) return { kind: "denied" as const };
        if (row.state === "aborted" && row.file_id === null) {
          const marked = await tx.query(
            "SELECT id FROM public.file_events WHERE upload_id=$1 AND process_code='upload_cleanup' AND action='cleanup_claimed' LIMIT 1",
            [id],
          );
          if (marked.rows.length === 1)
            await store.discard(
              id,
              Math.ceil(Number(row.declared_size) / before.chunkSize),
            );
          return { kind: "conflict" as const };
        }
        if (
          !["initialized", "receiving"].includes(row.state) ||
          Number(row.chunk_size) !== before.chunkSize ||
          index >= Math.ceil(Number(row.declared_size) / before.chunkSize)
        )
          return { kind: "conflict" as const };
        const current = await tx.query(
          "SELECT size_bytes::text,encode(sha256,'hex') AS sha256 FROM public.upload_chunks WHERE upload_id=$1 AND segment_index=$2",
          [id, index],
        );
        if (current.rows.length)
          return current.rows.length === 1 &&
            Number(current.rows[0]!.size_bytes) === before.sizeBytes &&
            current.rows[0]!.sha256 === expected
            ? { kind: "received" as const, repeated: true }
            : { kind: "conflict" as const };
        await tx.query(
          `INSERT INTO public.upload_chunks
          (upload_id,clinic_id,declared_size,chunk_size,segment_index,size_bytes,sha256)
          VALUES($1,$2,$3,$4,$5,$6,decode($7,'hex'))`,
          [
            id,
            row.clinic_id,
            row.declared_size,
            row.chunk_size,
            index,
            before.sizeBytes,
            expected,
          ],
        );
        const updated = await tx.query(
          `UPDATE public.upload_sessions
          SET state='receiving',received_bytes=received_bytes+$2,revision=revision+1
          WHERE id=$1 AND revision=$3 AND state IN ('initialized','receiving')
            AND expires_at>statement_timestamp() RETURNING id`,
          [id, before.sizeBytes, row.revision],
        );
        if (updated.rows.length !== 1)
          throw new Error("UPLOAD_RECEIPT_CONFLICT");
        return { kind: "received" as const, repeated: false };
      });
    },
    async inspect(actor: Actor, id: string) {
      const receipt = await db.transaction(async (tx) => {
        const row = await load(tx, actor, id, "FOR SHARE");
        if (!row || row.state !== "verifying" || !row.file_id) return null;
        const result = await tx.query<{
          object_key: string;
          size_bytes: string;
          sha256: string;
          format: FileFormat;
        }>(
          `SELECT object_key,size_bytes::text,encode(content_sha256,'hex') AS sha256,format
           FROM public.file_objects WHERE id=$1 AND clinic_id=$2 AND state='verifying' FOR SHARE`,
          [row.file_id, row.clinic_id],
        );
        if (result.rows.length !== 1) return null;
        return {
          fileId: row.file_id,
          clinicId: row.clinic_id,
          ...result.rows[0]!,
        };
      });
      if (!receipt || !sha.test(receipt.sha256))
        return { kind: "denied" as const };
      const verdict = await store.inspectObject(
        receipt.object_key,
        Number(receipt.size_bytes),
        receipt.sha256,
        receipt.format,
      );
      await db.transaction(async (tx) => {
        const row = await load(tx, actor, id, "FOR UPDATE");
        if (
          !row ||
          row.state !== "verifying" ||
          row.file_id !== receipt.fileId ||
          row.clinic_id !== receipt.clinicId
        )
          throw new Error("UPLOAD_INSPECTION_CONFLICT");
        const current = await tx.query(
          "SELECT id FROM public.file_objects WHERE id=$1 AND clinic_id=$2 AND state='verifying' AND object_key=$3 AND content_sha256=decode($4,'hex') FOR SHARE",
          [
            receipt.fileId,
            receipt.clinicId,
            receipt.object_key,
            receipt.sha256,
          ],
        );
        if (current.rows.length !== 1)
          throw new Error("UPLOAD_INSPECTION_CONFLICT");
        await tx.query(
          "INSERT INTO public.file_events(file_id,process_code,action) VALUES($1,'structure_probe',$2)",
          [receipt.fileId, verdict],
        );
      });
      // A candidate from the preliminary parser is not a publication proof.
      // Full parser and malware ports are absent from runtime by default.
      const evidence =
        verdict === "candidate" && validation
          ? await validation.inspect(
              {
                objectKey: receipt.object_key,
                sizeBytes: Number(receipt.size_bytes),
                sha256: receipt.sha256,
                format: receipt.format,
              },
              new AbortController().signal,
            )
          : { kind: "blocked" as const };
      const persisted = validation
        ? await db.transaction(async (tx) => {
            const row = await load(tx, actor, id, "FOR UPDATE");
            if (
              !row ||
              row.state !== "verifying" ||
              row.file_id !== receipt.fileId ||
              row.clinic_id !== receipt.clinicId
            )
              throw new Error("UPLOAD_INSPECTION_CONFLICT");
            const current = await tx.query(
              `SELECT id FROM public.file_objects WHERE id=$1 AND clinic_id=$2
             AND state='verifying' AND object_key=$3 AND size_bytes=$4
             AND content_sha256=decode($5,'hex') AND format=$6 FOR SHARE`,
              [
                receipt.fileId,
                receipt.clinicId,
                receipt.object_key,
                receipt.size_bytes,
                receipt.sha256,
                receipt.format,
              ],
            );
            if (current.rows.length !== 1)
              throw new Error("UPLOAD_INSPECTION_CONFLICT");
            const matched =
              evidence.kind === "evidence" &&
              evidence.policyVersion === validation.policyVersion &&
              evidence.object.objectKey === receipt.object_key &&
              evidence.object.sizeBytes === Number(receipt.size_bytes) &&
              evidence.object.sha256 === receipt.sha256 &&
              evidence.object.format === receipt.format;
            await tx.query(
              `INSERT INTO public.file_validation_attempts
             (upload_id,file_id,clinic_id,object_key,size_bytes,content_sha256,
              policy_version,parser_version,parser_reference,scanner_version,
              scanner_reference,verdict,reason)
             VALUES($1,$2,$3,$4,$5,decode($6,'hex'),$7,$8,$9,$10,$11,$12,$13)`,
              [
                id,
                receipt.fileId,
                receipt.clinicId,
                receipt.object_key,
                receipt.size_bytes,
                receipt.sha256,
                validation.policyVersion,
                matched ? evidence.parser.version : null,
                matched ? evidence.parser.reference : null,
                matched ? evidence.scanner.version : null,
                matched ? evidence.scanner.reference : null,
                matched ? "candidate" : "blocked",
                matched ? "checks_matched" : "checks_incomplete",
              ],
            );
            return matched;
          })
        : false;
      return {
        kind: "quarantined" as const,
        structure: verdict,
        validation: persisted ? ("evidence" as const) : ("blocked" as const),
      };
    },
    async finalize(
      actor: Actor,
      id: string,
      expected: string,
      filename: string,
      format: "stl" | "ply" | "obj" | "jpg" | "png" | "heic" | "pdf",
    ) {
      if (
        !sha.test(expected) ||
        !filename.trim() ||
        filename.length > 255 ||
        /[\\/\r\n\0]/.test(filename) ||
        !["stl", "ply", "obj", "jpg", "png", "heic", "pdf"].includes(format)
      )
        return { kind: "invalid" as const };
      const claim = await db.transaction(async (tx) => {
        const row = await load(tx, actor, id, "FOR UPDATE");
        if (!row) return { kind: "denied" as const };
        if (row.state === "verifying") {
          if (!row.file_id) return { kind: "reconciliation_required" as const };
          const file = await tx.query(
            "SELECT object_key,size_bytes::text,encode(content_sha256,'hex') AS sha256,state,filename_original,format FROM public.file_objects WHERE id=$1 AND clinic_id=$2 FOR SHARE",
            [row.file_id, row.clinic_id],
          );
          if (
            file.rows.length !== 1 ||
            file.rows[0]!.state !== "verifying" ||
            file.rows[0]!.sha256 !== expected ||
            file.rows[0]!.filename_original !== filename ||
            file.rows[0]!.format !== format
          )
            return { kind: "conflict" as const };
          return {
            kind: "existing" as const,
            fileId: row.file_id,
            objectKey: file.rows[0]!.object_key as string,
            sizeBytes: Number(file.rows[0]!.size_bytes),
          };
        }
        if (!["initialized", "receiving"].includes(row.state))
          return { kind: "conflict" as const };
        const manifest = await parts(tx, id);
        const plan = uploadProgress(
          Number(row.declared_size),
          Number(row.chunk_size),
          manifest,
          policy.maxSegments,
        );
        if (!plan.complete || plan.receivedBytes !== Number(row.received_bytes))
          return { kind: "incomplete" as const, missing: plan.missing };
        const updated = await tx.query(
          `UPDATE public.upload_sessions
          SET state='verifying',revision=revision+1 WHERE id=$1 AND revision=$2
          AND state IN ('initialized','receiving') AND expires_at>statement_timestamp() RETURNING id`,
          [id, row.revision],
        );
        if (updated.rows.length !== 1)
          throw new Error("UPLOAD_FINALIZE_CONFLICT");
        return {
          kind: "claimed" as const,
          clinicId: row.clinic_id,
          sizeBytes: Number(row.declared_size),
          chunkSize: Number(row.chunk_size),
          manifest,
        };
      });
      if (claim.kind === "existing") {
        await store.verifyObject(claim.objectKey, claim.sizeBytes, expected);
        return {
          kind: "awaiting_inspection" as const,
          fileId: claim.fileId,
          repeated: true,
        };
      }
      if (claim.kind !== "claimed") return claim;
      // Crash after claim retains verifying/file_id NULL for manual reconciliation.
      const sealed = await store.assemble(
        id,
        claim.sizeBytes,
        claim.chunkSize,
        policy.maxSegments,
        claim.manifest,
        expected,
      );
      return db.transaction(async (tx) => {
        const row = await load(tx, actor, id, "FOR UPDATE");
        if (
          !row ||
          row.state !== "verifying" ||
          row.file_id !== null ||
          row.clinic_id !== claim.clinicId
        )
          return { kind: "reconciliation_required" as const };
        const fileId = randomUUID();
        await tx.query(
          `INSERT INTO public.file_objects
          (id,clinic_id,created_by,object_key,filename_original,format,size_bytes,
           content_sha256,state,storage_policy_version)
          VALUES($1,$2,$3,$4,$5,$6,$7,decode($8,'hex'),'verifying',$9)`,
          [
            fileId,
            row.clinic_id,
            actor.accountId,
            sealed.objectKey,
            filename,
            format,
            sealed.sizeBytes,
            sealed.sha256,
            policy.storagePolicyVersion,
          ],
        );
        const updated = await tx.query(
          `UPDATE public.upload_sessions
          SET file_id=$2,revision=revision+1 WHERE id=$1 AND state='verifying'
          AND file_id IS NULL AND expires_at>statement_timestamp() RETURNING id`,
          [id, fileId],
        );
        if (updated.rows.length !== 1)
          throw new Error("UPLOAD_ASSEMBLY_CONFLICT");
        await tx.query(
          "INSERT INTO public.file_events(upload_id,process_code,action) VALUES($1,'upload_controller','assembled_private')",
          [id],
        );
        return {
          kind: "awaiting_inspection" as const,
          fileId,
          repeated: false,
        };
      });
    },
  };
}
