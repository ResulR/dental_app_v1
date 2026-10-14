CREATE TABLE public.clinic_contact_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id uuid NOT NULL REFERENCES public.clinics(id),
    actor_id uuid NOT NULL REFERENCES public.accounts(id),
    previous_revision bigint NOT NULL CHECK(previous_revision>0),
    aggregate_revision bigint NOT NULL CHECK(aggregate_revision=previous_revision+1),
    request_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(occurred_at)),
    previous_name text NOT NULL CHECK(btrim(previous_name)<>'' AND length(previous_name)<=2000),
    previous_dentist_first_name text NOT NULL CHECK(btrim(previous_dentist_first_name)<>'' AND length(previous_dentist_first_name)<=2000),
    previous_dentist_last_name text NOT NULL CHECK(btrim(previous_dentist_last_name)<>'' AND length(previous_dentist_last_name)<=2000),
    previous_phone text NOT NULL CHECK(btrim(previous_phone)<>'' AND length(previous_phone)<=2000),
    previous_address text NOT NULL CHECK(btrim(previous_address)<>'' AND length(previous_address)<=2000),
    next_name text NOT NULL CHECK(btrim(next_name)<>'' AND length(next_name)<=2000),
    next_dentist_first_name text NOT NULL CHECK(btrim(next_dentist_first_name)<>'' AND length(next_dentist_first_name)<=2000),
    next_dentist_last_name text NOT NULL CHECK(btrim(next_dentist_last_name)<>'' AND length(next_dentist_last_name)<=2000),
    next_phone text NOT NULL CHECK(btrim(next_phone)<>'' AND length(next_phone)<=2000),
    next_address text NOT NULL CHECK(btrim(next_address)<>'' AND length(next_address)<=2000),
    UNIQUE(clinic_id,aggregate_revision)
);
GRANT SELECT,INSERT ON public.clinic_contact_events TO dental_lab_app;
