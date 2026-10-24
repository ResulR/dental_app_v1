import { expect, test, vi } from "vitest";
import { appendClinicalMailIntent } from "../../apps/api/dist/modules/notifications/clinical-mail-intent.repository.js";
import { appendLaboratoryOrderMailIntent } from "../../apps/api/dist/modules/notifications/laboratory-mail-intent.repository.js";

const event = "91000000-0000-4000-8000-000000000001";

function scenario({
  laboratory,
  stale = false,
  revoked = false,
  fail = false,
}) {
  const calls = [];
  const query = vi.fn(async (sql, args = []) => {
    calls.push([sql, args]);
    if (sql.startsWith("SELECT e.type,d.state"))
      return {
        rows: [
          {
            type: laboratory ? "order_submitted" : "order_accepted",
            state: "pending",
          },
        ],
      };
    if (sql.startsWith("SELECT o.id FROM public.outbox_events"))
      return { rows: stale ? [] : [{ id: event }] };
    if (sql.startsWith("SELECT a.id FROM public.outbox_events"))
      return { rows: revoked ? [] : [{ id: event }] };
    if (sql.startsWith("SELECT a.id FROM public.owner_slot"))
      return { rows: [{ id: event }] };
    if (sql.startsWith("SELECT a.id FROM public.email_category_recipients"))
      return {
        rows: revoked ? [] : [{ id: "91000000-0000-4000-8000-000000000002" }],
      };
    if (sql.startsWith("INSERT INTO public.notification_deliveries")) {
      if (fail) throw Error("TRANSIENT_DB_FAILURE");
      return { rows: [{ id: event }] };
    }
    throw Error("UNEXPECTED_SQL");
  });
  return { calls, query };
}

for (const laboratory of [false, true]) {
  test(`${laboratory ? "laboratory" : "clinical"} preparation locks revision before recipient selection`, async () => {
    const f = scenario({ laboratory });
    const result = await (
      laboratory ? appendLaboratoryOrderMailIntent : appendClinicalMailIntent
    )(f, event);
    expect(result).toBe("prepared");
    const sql = f.calls.map(([statement]) => statement);
    expect(sql[0]).toContain("FOR UPDATE OF d");
    expect(sql[1]).toContain("o.revision=e.aggregate_revision");
    expect(sql[1]).toContain("FOR SHARE OF o");
    expect(sql.at(-1)).toContain(
      "ON CONFLICT(event_id,target_account_id,channel,purpose) DO NOTHING",
    );
    expect(sql.at(-1)).not.toMatch(
      /patient_reference|message_text|email_original|body/,
    );
    if (laboratory) {
      expect(sql[2]).toContain("FOR SHARE OF a");
      expect(sql[3]).toContain("FOR SHARE OF a");
      expect(sql[3]).not.toMatch(/FOR SHARE OF r|FOR SHARE OF detail/);
      expect(f.calls.at(-1)[1][2]).toEqual([
        event,
        "91000000-0000-4000-8000-000000000002",
      ]);
    } else {
      expect(sql[2]).toContain("FOR SHARE OF c,a");
    }
  });
  test(`${laboratory ? "laboratory" : "clinical"} stale revision aborts before any recipient query or write`, async () => {
    const f = scenario({ laboratory, stale: true });
    expect(
      await (
        laboratory ? appendLaboratoryOrderMailIntent : appendClinicalMailIntent
      )(f, event),
    ).toBe("skipped");
    expect(f.calls).toHaveLength(2);
  });
  test(`${laboratory ? "laboratory" : "clinical"} transient write error propagates for transaction rollback and retry`, async () => {
    const failed = scenario({ laboratory, fail: true });
    await expect(
      (laboratory ? appendLaboratoryOrderMailIntent : appendClinicalMailIntent)(
        failed,
        event,
      ),
    ).rejects.toThrow("TRANSIENT_DB_FAILURE");
    const retried = scenario({ laboratory });
    expect(
      await (
        laboratory ? appendLaboratoryOrderMailIntent : appendClinicalMailIntent
      )(retried, event),
    ).toBe("prepared");
  });
}

test("revoked clinic is skipped before write; revoked admin is excluded from insert candidates", async () => {
  const clinic = scenario({ laboratory: false, revoked: true });
  expect(await appendClinicalMailIntent(clinic, event)).toBe("skipped");
  expect(clinic.calls).toHaveLength(3);
  const lab = scenario({ laboratory: true, revoked: true });
  expect(await appendLaboratoryOrderMailIntent(lab, event)).toBe("prepared");
  expect(lab.calls.at(-1)[1][2]).toEqual([event]);
});
