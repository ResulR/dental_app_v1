import { randomUUID } from "node:crypto";
import type { createApplicationDatabase } from "../../shared/database.js";
import { currentRequestCorrelation } from "../../shared/request-correlation.js";
import type { StoredRegistration } from "./registration.service.js";

type Database = Pick<
  ReturnType<typeof createApplicationDatabase>,
  "query" | "transaction"
>;
const ownerSql = `SELECT a.id FROM public.owner_slot s
JOIN public.accounts a ON a.id=s.account_id AND a.profile='owner'
WHERE s.singleton=1 AND a.lifecycle='active'`;
const termsSql = `SELECT version_id FROM public.registration_current_terms WHERE singleton=1`;

export function createClinicRegistrationRepository(database: Database) {
  return {
    async currentTermsVersion(): Promise<string | undefined> {
      return (await database.query<{ version_id: string }>(termsSql)).rows[0]
        ?.version_id;
    },
    async ownerInitialized(): Promise<boolean> {
      return (await database.query(ownerSql)).rows.length === 1;
    },
    async registerAtomic(
      data: StoredRegistration,
    ): Promise<"created" | "duplicate" | "terms_changed" | "unavailable"> {
      try {
        return await database.transaction(async (tx) => {
          // SHARE blocks publication/deletion of the current pointer until commit.
          // UPDATE(singleton) permits this lock, but CHECK singleton=1 prevents a
          // value change and the app cannot update version_id or publish a text.
          const current = await tx.query<{ version_id: string }>(
            termsSql + " FOR SHARE",
          );
          if (current.rows.length !== 1) return "unavailable";
          if (
            current.rows[0]?.version_id.toLowerCase() !==
            data.terms_version_id.toLowerCase()
          )
            return "terms_changed";
          if ((await tx.query(ownerSql)).rows.length !== 1)
            return "unavailable";
          const account = randomUUID(),
            clinic = randomUUID(),
            event = randomUUID();
          const correlation = currentRequestCorrelation();
          await tx.query(
            "INSERT INTO public.accounts(id,profile,email_original,email_key,lifecycle) VALUES($1,'clinic',$2,$3,'active')",
            [account, data.email, data.email_key],
          );
          await tx.query(
            "INSERT INTO public.clinics(id,account_id,name,dentist_first_name,dentist_last_name,phone,address,review_state) VALUES($1,$2,$3,$4,$5,$6,$7,'pending')",
            [
              clinic,
              account,
              data.name,
              data.dentist_first_name,
              data.dentist_last_name,
              data.phone,
              data.address,
            ],
          );
          await tx.query(
            "INSERT INTO public.credentials(account_id,password_hash) VALUES($1,$2)",
            [account, data.password_hash],
          );
          await tx.query(
            "INSERT INTO public.clinic_terms_acceptances(account_id,terms_version_id) VALUES($1,$2)",
            [account, data.terms_version_id],
          );
          const generalConversation = await tx.query<{ id: string }>(
            "INSERT INTO public.conversations(clinic_id,kind) VALUES($1,'general') RETURNING id",
            [clinic],
          );
          if (generalConversation.rows.length !== 1)
            throw new Error("GENERAL_CONVERSATION_NOT_CREATED");
          await tx.query(
            "INSERT INTO public.conversation_reads(conversation_id,side) VALUES($1,'clinic'),($1,'laboratory')",
            [generalConversation.rows[0]!.id],
          );
          await tx.query(
            "INSERT INTO public.audit_events(process_code,action,object_type,object_id,request_id,aggregate_revision) VALUES('clinic_registration','CLINIC_REGISTERED','clinic',$1,$2,1)",
            [clinic, correlation],
          );
          await tx.query(
            "INSERT INTO public.outbox_events(id,type,aggregate_type,aggregate_id,aggregate_revision,clinic_id,process_code,correlation_id) VALUES($1,'clinic_registered','clinic',$2,1,$2,'clinic_registration',$3)",
            [event, clinic, correlation],
          );
          await tx.query(
            "INSERT INTO public.outbox_dispatches(event_id) VALUES($1)",
            [event],
          );
          return "created";
        });
      } catch (error) {
        // The transaction wrapper has already rolled back. Only the canonical
        // email constraint denotes this public conflict; never swallow another
        // integrity error or retry an uncertain commit.
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23505" &&
          "constraint" in error &&
          error.constraint === "accounts_email_key_key"
        )
          return "duplicate";
        throw error;
      }
    },
  };
}
