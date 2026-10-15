CREATE TABLE public.delegation_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    target_account_id uuid NOT NULL REFERENCES public.accounts(id),
    actor_id uuid NOT NULL REFERENCES public.accounts(id),
    kind text NOT NULL CHECK(kind IN ('employee','envelope')),
    previous_revision bigint NOT NULL CHECK(previous_revision>0),
    aggregate_revision bigint NOT NULL CHECK(aggregate_revision=previous_revision+1),
    request_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP CHECK(isfinite(occurred_at)),
    previous_codes text[] NOT NULL CHECK(cardinality(previous_codes)<=29 AND array_position(previous_codes,NULL) IS NULL),
    next_codes text[] NOT NULL CHECK(cardinality(next_codes)<=29 AND array_position(next_codes,NULL) IS NULL),
    UNIQUE(target_account_id,aggregate_revision)
);
GRANT SELECT,INSERT ON public.delegation_events TO dental_lab_app;
