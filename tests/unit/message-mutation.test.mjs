import { test, expect, vi } from "vitest";
import {
  createGeneralMessagingService,
  createOrderMessagingService,
} from "../../apps/api/dist/modules/messaging/index.js";

const id = "91000000-0000-4000-8000-000000000001";
const other = "91000000-0000-4000-8000-000000000002";
const actor = { accountId: id, sessionId: id };
const input = {
  conversation_id: id,
  message_id: id,
  expected_revision: 1,
  body: "Teksti i ri",
};
function fixture({
  kind = "general",
  foreign = false,
  author = id,
  closed = false,
  grants = [],
  profile = "clinic",
  files = false,
  failAudit = false,
  versionCount = 1,
} = {}) {
  let revision = 1;
  let hidden = false;
  const calls = [];
  const query = vi.fn(async (sql, args = []) => {
    calls.push([sql, args]);
    if (sql.startsWith("SELECT a.profile"))
      return {
        rows: [
          {
            profile,
            lifecycle: "active",
            securityLocked: false,
            resetRequired: false,
            sessionValid: true,
            ownerCurrent: true,
            clinicId: id,
            clinicSuspended: false,
            grants,
          },
        ],
      };
    if (sql.startsWith("SELECT id FROM public.clinics WHERE account_id=$1 AND"))
      return { rows: [{ id }] };
    if (
      sql.startsWith("SELECT id,clinic_id,closed_at FROM public.conversations")
    )
      return {
        rows: foreign
          ? []
          : [{ id, clinic_id: id, closed_at: closed ? new Date() : null }],
      };
    if (
      sql.startsWith(
        "SELECT id,revision::text,current_version_id,hidden_at FROM public.messages",
      )
    )
      return {
        rows:
          author !== id
            ? []
            : [
                {
                  id,
                  revision: String(revision),
                  current_version_id: id,
                  hidden_at: hidden ? new Date() : null,
                },
              ],
      };
    if (sql.startsWith("SELECT 1 FROM public.message_version_files"))
      return { rows: files ? [{ one: 1 }] : [] };
    if (sql.startsWith("SELECT m.id FROM public.messages m JOIN"))
      return { rows: author === id && !foreign ? [{ id }] : [] };
    if (sql.startsWith("SELECT version_number::text,body,created_at"))
      return {
        rows: Array.from(
          { length: versionCount },
          (_, index) => versionCount - index,
        )
          .filter((number) => args[1] === null || number < args[1])
          .slice(0, 51)
          .map((number) => ({
            version_number: String(number),
            body: number === 1 ? "Origjinali" : "Versioni " + number,
            created_at: new Date("2026-10-21T10:00:00.000Z"),
          })),
      };
    if (sql.startsWith("UPDATE public.messages SET current_version_id"))
      revision++;
    if (sql.startsWith("UPDATE public.messages SET hidden_at")) {
      revision++;
      hidden = true;
    }
    if (failAudit && sql.startsWith("INSERT INTO public.audit_events"))
      throw new Error("AUDIT_FAILED");
    return { rows: [] };
  });
  const repo = (
    kind === "general"
      ? createGeneralMessagingService
      : createOrderMessagingService
  )({
    transaction: async (fn) => {
      const previous = [revision, hidden];
      try {
        return await fn({ query });
      } catch (error) {
        [revision, hidden] = previous;
        throw error;
      }
    },
  });
  return { repo, calls, state: () => ({ revision, hidden }) };
}
test("author edit versions in one transaction, optimistic retry conflicts, history stays scoped", async () => {
  const f = fixture();
  const first = await f.repo.mutate(actor, input, "edit");
  expect(first.result).toMatchObject({ kind: "updated", revision: 2 });
  expect(
    f.calls.some(
      ([sql, args]) =>
        sql.startsWith("INSERT INTO public.message_versions") && args[3] === 2,
    ),
  ).toBe(true);
  expect(
    f.calls.some(
      ([sql, args]) =>
        sql.startsWith("INSERT INTO public.outbox_events") &&
        args[1] === "message_edited",
    ),
  ).toBe(true);
  expect(
    f.calls.some(
      ([sql, args]) =>
        sql.startsWith("INSERT INTO public.audit_events") &&
        args[1] === "MESSAGE_EDITED",
    ),
  ).toBe(true);
  expect((await f.repo.mutate(actor, input, "edit")).result.kind).toBe(
    "conflict",
  );
  expect(f.state().revision).toBe(2);
  expect(
    (await f.repo.history(actor, { conversation_id: id, message_id: id }))
      .result.versions[0].body,
  ).toBe("Origjinali");
});
test("author version history paginates without exposing or repeating older versions", async () => {
  const f = fixture({ versionCount: 120 });
  const first = (
    await f.repo.history(actor, { conversation_id: id, message_id: id })
  ).result;
  expect(first.versions).toHaveLength(50);
  expect(first.next_before_version).toBe(71);
  const second = (
    await f.repo.history(actor, {
      conversation_id: id,
      message_id: id,
      before_version: first.next_before_version,
    })
  ).result;
  expect(second.versions[0].version_number).toBe(70);
  expect(second.next_before_version).toBe(21);
  const third = (
    await f.repo.history(actor, {
      conversation_id: id,
      message_id: id,
      before_version: second.next_before_version,
    })
  ).result;
  expect(third.versions.at(-1).version_number).toBe(1);
  expect(third.next_before_version).toBeNull();
});
test("hide is author-only, blocks repeats and preserves version text and audit", async () => {
  const f = fixture({ kind: "order" });
  expect(
    (
      await f.repo.mutate(
        actor,
        { conversation_id: id, message_id: id, expected_revision: 1 },
        "hide",
      )
    ).result.kind,
  ).toBe("updated");
  expect(f.state()).toEqual({ revision: 2, hidden: true });
  expect(
    (
      await f.repo.mutate(
        actor,
        { conversation_id: id, message_id: id, expected_revision: 2 },
        "hide",
      )
    ).result.kind,
  ).toBe("conflict");
  expect(
    f.calls.some(
      ([sql, args]) =>
        sql.startsWith("INSERT INTO public.outbox_events") &&
        args[1] === "message_hidden",
    ),
  ).toBe(true);
  expect(
    f.calls.filter(([sql]) =>
      sql.startsWith("INSERT INTO public.message_versions"),
    ),
  ).toHaveLength(0);
});
test("foreign scope, other author, closure, file version and absent reply grant refuse mutation", async () => {
  for (const [options, expected] of [
    [{ foreign: true }, "denied"],
    [{ author: other }, "denied"],
    [{ closed: true }, "closed"],
    [{ files: true }, "conflict"],
    [{ profile: "employee", grants: ["messaging.general.read"] }, "denied"],
  ]) {
    const f = fixture(options);
    const result = await f.repo.mutate(actor, input, "edit");
    expect(result.kind === "result" ? result.result.kind : result.kind).toBe(
      expected,
    );
    expect(
      f.calls.some(([sql]) =>
        sql.startsWith("INSERT INTO public.message_versions"),
      ),
    ).toBe(false);
  }
  const f = fixture({ author: other });
  expect(
    (await f.repo.history(actor, { conversation_id: id, message_id: id })).kind,
  ).toBe("denied");
  const foreign = fixture({ foreign: true });
  expect(
    (await foreign.repo.history(actor, { conversation_id: id, message_id: id }))
      .kind,
  ).toBe("denied");
});
test("validation and audit failure never return success or leave partial mutation", async () => {
  const f = fixture({ failAudit: true });
  expect(
    (await f.repo.mutate(actor, { ...input, body: " " }, "edit")).kind,
  ).toBe("invalid");
  expect(
    (await f.repo.mutate(actor, { ...input, body: "extra" }, "hide")).kind,
  ).toBe("invalid");
  await expect(f.repo.mutate(actor, input, "edit")).rejects.toThrow(
    "AUDIT_FAILED",
  );
  expect(f.state()).toEqual({ revision: 1, hidden: false });
});
