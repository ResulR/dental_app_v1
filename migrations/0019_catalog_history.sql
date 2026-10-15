-- Preparation only: no migration executed by dental-ai.
CREATE TABLE public.catalog_change_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reference_id uuid NOT NULL REFERENCES public.catalog_references(id),
 actor_id uuid NOT NULL REFERENCES public.accounts(id),
 operation text NOT NULL CHECK(operation IN ('create','update','remove','restrict')),
 aggregate_revision bigint NOT NULL CHECK(aggregate_revision>0),
 request_id uuid NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 previous_state jsonb CHECK(previous_state IS NULL OR jsonb_typeof(previous_state)='object'),
 next_state jsonb NOT NULL CHECK(jsonb_typeof(next_state)='object'),
 UNIQUE(reference_id,aggregate_revision)
);
GRANT SELECT,INSERT ON public.catalog_change_events TO dental_lab_app;
