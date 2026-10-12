CREATE TABLE public.clinic_review_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id uuid NOT NULL REFERENCES public.clinics(id),
    actor_id uuid NOT NULL REFERENCES public.accounts(id),
    previous_state text NOT NULL CHECK(previous_state='pending'),
    next_state text NOT NULL CHECK(next_state IN ('approved','refused')),
    reason text CHECK(reason IS NULL OR btrim(reason)<>''),
    aggregate_revision bigint NOT NULL CHECK(aggregate_revision>0),
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(occurred_at)),
    UNIQUE(clinic_id,aggregate_revision)
);
GRANT SELECT,INSERT ON public.clinic_review_events TO dental_lab_app;
