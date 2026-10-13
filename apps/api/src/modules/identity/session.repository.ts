import { randomUUID } from "node:crypto";
import { currentRequestCorrelation } from "../../shared/request-correlation.js";
import type {
  createApplicationDatabase,
  DatabaseExecutor,
} from "../../shared/database.js";
import type { SessionRecord, SessionStore, SessionWrite } from "./sessions.js";

type Database = Pick<
  ReturnType<typeof createApplicationDatabase>,
  "query" | "transaction"
>;
type Account = {
  profile: SessionRecord["profile"];
  lifecycle: string;
  security_locked: boolean;
  credential_reset_required: boolean;
  auth_epoch: string;
};
type StoredSession = Omit<
  SessionRecord,
  "createdAt" | "expiresAt" | "absoluteExpiresAt" | "revokedAt"
> & {
  createdAt: string;
  expiresAt: string;
  absoluteExpiresAt: string;
  revokedAt: string | null;
};
const projection = `
  s.id,s.account_id AS "accountId",a.profile,s.auth_epoch::text AS "authEpoch",
  a.auth_epoch::text AS "currentAuthEpoch",
  (a.lifecycle='active' AND NOT a.security_locked AND NOT a.credential_reset_required
    AND (a.profile<>'clinic' OR EXISTS(SELECT 1 FROM public.clinics c WHERE c.account_id=a.id AND NOT c.suspended))
    AND (a.profile<>'owner' OR EXISTS(SELECT 1 FROM public.owner_slot o WHERE o.account_id=a.id))
  ) AS "accountUsable",
  (extract(epoch FROM s.created_at)*1000)::bigint::text AS "createdAt",
  (extract(epoch FROM s.expires_at)*1000)::bigint::text AS "expiresAt",
  (extract(epoch FROM l.absolute_expires_at)*1000)::bigint::text AS "absoluteExpiresAt",
  (extract(epoch FROM s.revoked_at)*1000)::bigint::text AS "revokedAt"`;
function copyWrite(input: SessionWrite): SessionWrite {
  const copy = {
    ...input,
    fact: { ...input.fact },
    digest: Buffer.from(input.digest),
  };
  if (
    copy.digest.length !== 32 ||
    !/^(0|[1-9][0-9]*)$/.test(copy.fact.authEpoch) ||
    ![copy.createdAt, copy.expiresAt, copy.absoluteExpiresAt].every(
      (value) =>
        Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000,
    ) ||
    copy.expiresAt <= copy.createdAt ||
    copy.absoluteExpiresAt < copy.expiresAt ||
    copy.absoluteExpiresAt - copy.createdAt > 30 * 24 * 60 * 60 * 1000
  )
    throw new Error("INVALID_SESSION_WRITE");
  return copy;
}
async function lockAccount(
  tx: DatabaseExecutor,
  id: string,
): Promise<Account | undefined> {
  const result = await tx.query<Account>(
    `SELECT profile,lifecycle,security_locked,
    credential_reset_required,auth_epoch::text FROM public.accounts WHERE id=$1 FOR UPDATE`,
    [id],
  );
  return result.rows[0];
}
async function eligible(
  tx: DatabaseExecutor,
  input: SessionWrite,
): Promise<boolean> {
  const account = await lockAccount(tx, input.fact.accountId);
  if (
    !account ||
    account.profile !== input.fact.profile ||
    account.auth_epoch !== input.fact.authEpoch ||
    account.lifecycle !== "active" ||
    account.security_locked ||
    account.credential_reset_required
  )
    return false;
  if (account.profile === "clinic") {
    const clinic = await tx.query<{ suspended: boolean }>(
      "SELECT suspended FROM public.clinics WHERE account_id=$1 FOR SHARE",
      [input.fact.accountId],
    );
    if (clinic.rows[0]?.suspended !== false) return false;
  }
  if (account.profile === "owner") {
    const owner = await tx.query(
      "SELECT account_id FROM public.owner_slot WHERE account_id=$1",
      [input.fact.accountId],
    );
    if (owner.rowCount !== 1) return false;
  }
  return true;
}
async function audit(
  tx: DatabaseExecutor,
  accountId: string,
  action: string,
): Promise<string> {
  const correlationId = currentRequestCorrelation();
  await tx.query(
    `INSERT INTO public.audit_events(actor_id,action,object_type,object_id,request_id)
    VALUES ($1,$2,'account',$1,$3)`,
    [accountId, action, correlationId],
  );
  return correlationId;
}
async function queueOwnerLoginAlert(
  tx: DatabaseExecutor,
  accountId: string,
  correlationId: string,
): Promise<void> {
  const revision = await tx.query<{ revision: string }>(
    "UPDATE public.accounts SET revision=revision+1 WHERE id=$1 RETURNING revision::text",
    [accountId],
  );
  if (!revision.rows[0]) throw new Error("OWNER_ALERT_REVISION_MISSING");
  const eventId = randomUUID();
  await tx.query(
    `INSERT INTO public.outbox_events
    (id,type,aggregate_type,aggregate_id,aggregate_revision,actor_id,correlation_id)
    VALUES ($1,'security_alert','account',$2,$3,$2,$4)`,
    [eventId, accountId, revision.rows[0].revision, correlationId],
  );
  await tx.query("INSERT INTO public.outbox_dispatches(event_id) VALUES ($1)", [
    eventId,
  ]);
  await tx.query(
    "INSERT INTO public.internal_notifications(event_id,target_account_id) VALUES ($1,$2)",
    [eventId, accountId],
  );
  await tx.query(
    `INSERT INTO public.notification_deliveries(event_id,target_account_id,channel,purpose)
    VALUES ($1,$2,'email','security')`,
    [eventId, accountId],
  );
}
async function insert(
  tx: DatabaseExecutor,
  input: SessionWrite,
  parent: string | null,
): Promise<void> {
  const id = randomUUID();
  const result = await tx.query(
    `INSERT INTO public.sessions
    (id,account_id,secret_digest,auth_epoch,created_at,expires_at,renewed_from_id)
    SELECT $1,$2,$3,$4,$5::timestamptz,$6::timestamptz,$7
    WHERE $5::timestamptz <= clock_timestamp() AND $6::timestamptz > clock_timestamp()`,
    [
      id,
      input.fact.accountId,
      input.digest,
      input.fact.authEpoch,
      new Date(input.createdAt),
      new Date(input.expiresAt),
      parent,
    ],
  );
  // Must throw after a rotation's revocation so the whole transaction rolls back.
  if (result.rowCount !== 1) throw new Error("SESSION_WINDOW_ELAPSED");
  await tx.query(
    `INSERT INTO public.session_limits
    (session_id,account_id,expires_at,absolute_expires_at,parent_key) VALUES ($1,$2,$3,$4,$5)`,
    [
      id,
      input.fact.accountId,
      new Date(input.expiresAt),
      new Date(input.absoluteExpiresAt),
      parent ?? id,
    ],
  );
}
export function createSessionRepository(database: Database): SessionStore {
  return {
    async find(digest) {
      if (digest.length !== 32) return undefined;
      const result = await database.query<StoredSession>(
        `SELECT ${projection}
        FROM public.sessions s JOIN public.accounts a ON a.id=s.account_id
        JOIN public.session_limits l ON l.session_id=s.id
        WHERE s.secret_digest=$1 AND s.revoked_at IS NULL AND s.auth_epoch=a.auth_epoch
          AND s.created_at <= clock_timestamp() AND s.expires_at > clock_timestamp()
          AND l.absolute_expires_at > clock_timestamp()`,
        [Buffer.from(digest)],
      );
      const row = result.rows[0];
      if (!row) return undefined;
      const record = {
        ...row,
        createdAt: Number(row.createdAt),
        expiresAt: Number(row.expiresAt),
        absoluteExpiresAt: Number(row.absoluteExpiresAt),
        revokedAt: row.revokedAt === null ? null : Number(row.revokedAt),
      };
      if (
        ![record.createdAt, record.expiresAt, record.absoluteExpiresAt].every(
          Number.isSafeInteger,
        )
      )
        throw new Error("INVALID_STORED_SESSION");
      return record;
    },
    async issue(value) {
      const input = copyWrite(value);
      return database.transaction(async (tx) => {
        if (!(await eligible(tx, input))) return false;
        await insert(tx, input, null);
        const correlationId = await audit(
          tx,
          input.fact.accountId,
          "SESSION_ISSUED",
        );
        if (input.fact.profile === "owner")
          await queueOwnerLoginAlert(tx, input.fact.accountId, correlationId);
        return true;
      });
    },
    async rotate(record, value) {
      const old = { ...record };
      const input = copyWrite(value);
      if (
        old.accountId !== input.fact.accountId ||
        old.profile !== input.fact.profile ||
        old.authEpoch !== input.fact.authEpoch ||
        old.absoluteExpiresAt !== input.absoluteExpiresAt
      )
        return false;
      return database.transaction(async (tx) => {
        if (!(await eligible(tx, input))) return false;
        const revoked = await tx.query(
          `UPDATE public.sessions s SET revoked_at=clock_timestamp()
          WHERE s.id=$1 AND s.account_id=$2 AND s.auth_epoch=$3 AND s.revoked_at IS NULL
            AND s.created_at <= clock_timestamp() AND s.expires_at > clock_timestamp()
            AND EXISTS(SELECT 1 FROM public.session_limits l WHERE l.session_id=s.id
              AND l.absolute_expires_at=$4::timestamptz AND l.absolute_expires_at > clock_timestamp())
          RETURNING s.id`,
          [
            old.id,
            old.accountId,
            old.authEpoch,
            new Date(input.absoluteExpiresAt),
          ],
        );
        if (revoked.rowCount !== 1) return false;
        await insert(tx, input, old.id);
        await audit(tx, old.accountId, "SESSION_ROTATED");
        return true;
      });
    },
    async revokeOne(accountId, sessionId) {
      await database.transaction(async (tx) => {
        if (!(await lockAccount(tx, accountId))) return;
        const result = await tx.query(
          `UPDATE public.sessions SET revoked_at=GREATEST(clock_timestamp(),created_at)
          WHERE id=$1 AND account_id=$2 AND revoked_at IS NULL RETURNING id`,
          [sessionId, accountId],
        );
        if (result.rowCount === 1)
          await audit(tx, accountId, "SESSION_REVOKED");
      });
    },
    async revokeAll(accountId) {
      await database.transaction(async (tx) => {
        if (!(await lockAccount(tx, accountId))) return;
        await tx.query(
          "UPDATE public.accounts SET auth_epoch=auth_epoch+1,revision=revision+1 WHERE id=$1",
          [accountId],
        );
        await tx.query(
          `UPDATE public.sessions SET revoked_at=GREATEST(clock_timestamp(),created_at)
          WHERE account_id=$1 AND revoked_at IS NULL`,
          [accountId],
        );
        await audit(tx, accountId, "ALL_SESSIONS_REVOKED");
      });
    },
  };
}
