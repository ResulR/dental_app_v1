ALTER TABLE public.clinics ADD CONSTRAINT clinics_id_account_unique UNIQUE(id,account_id);
ALTER TABLE public.submission_receipts ADD CONSTRAINT submission_receipts_id_owner_clinic_unique UNIQUE(id,account_id,clinic_id);
CREATE TABLE public.drafts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
    state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','deleted','submitted')),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(created_at)),
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(updated_at) AND updated_at>=created_at),
    deleted_at timestamptz CHECK(deleted_at IS NULL OR (isfinite(deleted_at) AND deleted_at>=created_at)),
    submission_receipt_id uuid,
    UNIQUE(id,clinic_id),
    UNIQUE(id,account_id,clinic_id),
    FOREIGN KEY(clinic_id,account_id) REFERENCES public.clinics(id,account_id),
    FOREIGN KEY(submission_receipt_id,account_id,clinic_id) REFERENCES public.submission_receipts(id,account_id,clinic_id),
    CHECK((state='deleted' AND deleted_at IS NOT NULL AND submission_receipt_id IS NULL)
       OR (state='submitted' AND deleted_at IS NULL AND submission_receipt_id IS NOT NULL)
       OR (state='active' AND deleted_at IS NULL AND submission_receipt_id IS NULL))
);
CREATE TABLE public.draft_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id uuid NOT NULL,
    account_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    revision bigint NOT NULL CHECK(revision>0),
    schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version>0),
    payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(created_at)),
    UNIQUE(draft_id,revision),
    UNIQUE(id,clinic_id),
    FOREIGN KEY(draft_id,account_id,clinic_id) REFERENCES public.drafts(id,account_id,clinic_id),
    CHECK(payload - ARRAY['patient','requested_delivery_date','material','shade','work_type','description','teeth']::text[] = '{}'::jsonb)
);
ALTER TABLE public.drafts ADD CONSTRAINT drafts_current_revision_fk
    FOREIGN KEY(id,revision) REFERENCES public.draft_revisions(draft_id,revision) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE public.draft_revision_files (
    revision_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    file_id uuid NOT NULL,
    PRIMARY KEY(revision_id,file_id),
    FOREIGN KEY(revision_id,clinic_id) REFERENCES public.draft_revisions(id,clinic_id),
    FOREIGN KEY(file_id,clinic_id) REFERENCES public.file_objects(id,clinic_id)
);
CREATE TABLE public.draft_sync_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    draft_id uuid NOT NULL,
    committed_revision bigint NOT NULL,
    action text NOT NULL CHECK(action IN ('save','delete','clone')),
    idempotency_key text COLLATE "C" NOT NULL CHECK(btrim(idempotency_key)<>''),
    payload_fingerprint bytea NOT NULL CHECK(octet_length(payload_fingerprint)=32),
    committed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(committed_at)),
    UNIQUE(account_id,idempotency_key),
    FOREIGN KEY(draft_id,account_id,clinic_id) REFERENCES public.drafts(id,account_id,clinic_id),
    FOREIGN KEY(draft_id,committed_revision) REFERENCES public.draft_revisions(draft_id,revision)
);
CREATE TABLE public.draft_conflicts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id uuid NOT NULL,
    account_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    base_revision bigint NOT NULL CHECK(base_revision>=0),
    server_revision bigint NOT NULL,
    resolution text NOT NULL DEFAULT 'open' CHECK(resolution IN ('open','take_server','clone_local')),
    cloned_draft_id uuid,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(created_at)),
    resolved_at timestamptz,
    FOREIGN KEY(draft_id,account_id,clinic_id) REFERENCES public.drafts(id,account_id,clinic_id),
    FOREIGN KEY(draft_id,server_revision) REFERENCES public.draft_revisions(draft_id,revision),
    FOREIGN KEY(cloned_draft_id,account_id,clinic_id) REFERENCES public.drafts(id,account_id,clinic_id),
    CHECK(cloned_draft_id IS NULL OR cloned_draft_id<>draft_id),
    CHECK((resolution='open' AND resolved_at IS NULL AND cloned_draft_id IS NULL)
       OR (resolution='take_server' AND resolved_at IS NOT NULL AND isfinite(resolved_at) AND resolved_at>=created_at AND cloned_draft_id IS NULL)
       OR (resolution='clone_local' AND resolved_at IS NOT NULL AND isfinite(resolved_at) AND resolved_at>=created_at AND cloned_draft_id IS NOT NULL))
);
ALTER TABLE public.upload_sessions ADD COLUMN intended_draft_id uuid;
ALTER TABLE public.upload_sessions ADD CONSTRAINT upload_draft_owner_fk
    FOREIGN KEY(intended_draft_id,account_id,clinic_id) REFERENCES public.drafts(id,account_id,clinic_id);
ALTER TABLE public.upload_sessions ADD CONSTRAINT upload_draft_destination_kind
    CHECK(intended_kind='draft' OR intended_draft_id IS NULL);
CREATE INDEX drafts_account_state_idx ON public.drafts(account_id,state);
