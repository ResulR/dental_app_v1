CREATE TABLE public.registration_terms_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    locale text NOT NULL CHECK(locale='sq'),
    body text NOT NULL CHECK(btrim(body)<>'' AND octet_length(body)<=1048576),
    body_sha256 bytea NOT NULL CHECK(octet_length(body_sha256)=32),
    approval_reference text NOT NULL CHECK(btrim(approval_reference)<>''),
    approved_at timestamptz NOT NULL CHECK(isfinite(approved_at)),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(created_at))
);
CREATE TABLE public.registration_current_terms (
    singleton smallint PRIMARY KEY CHECK(singleton=1),
    version_id uuid NOT NULL REFERENCES public.registration_terms_versions(id)
);
CREATE TABLE public.clinic_terms_acceptances (
    account_id uuid NOT NULL,
    account_profile text GENERATED ALWAYS AS ('clinic'::text) STORED,
    terms_version_id uuid NOT NULL REFERENCES public.registration_terms_versions(id),
    accepted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(accepted_at)),
    PRIMARY KEY(account_id,terms_version_id),
    FOREIGN KEY(account_id,account_profile) REFERENCES public.accounts(id,profile)
);
GRANT SELECT ON public.registration_terms_versions,public.registration_current_terms,public.clinic_terms_acceptances TO dental_lab_app;
GRANT UPDATE(singleton) ON public.registration_current_terms TO dental_lab_app;
GRANT INSERT(account_id,terms_version_id) ON public.clinic_terms_acceptances TO dental_lab_app;
