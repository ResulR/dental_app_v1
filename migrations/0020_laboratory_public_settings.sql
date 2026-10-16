-- Preparation only. No production execution authorized.
CREATE TABLE public.laboratory_public_settings (
 id uuid PRIMARY KEY CHECK(id='86000000-0000-4000-8000-000000000001'),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 fields jsonb,
 changed_by uuid REFERENCES public.accounts(id),
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK(isfinite(changed_at)),
 CHECK((revision=0 AND fields IS NULL AND changed_by IS NULL)
    OR (revision>0 AND fields IS NOT NULL AND jsonb_typeof(fields)='object' AND changed_by IS NOT NULL))
);
INSERT INTO public.laboratory_public_settings(id) VALUES('86000000-0000-4000-8000-000000000001');
CREATE TABLE public.laboratory_settings_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 settings_id uuid NOT NULL REFERENCES public.laboratory_public_settings(id),
 actor_id uuid NOT NULL REFERENCES public.accounts(id),
 aggregate_revision bigint NOT NULL CHECK(aggregate_revision>0),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK(isfinite(occurred_at)),
 request_id uuid NOT NULL,
 previous_state jsonb CHECK(previous_state IS NULL OR jsonb_typeof(previous_state)='object'),
 next_state jsonb NOT NULL CHECK(jsonb_typeof(next_state)='object'),
 UNIQUE(settings_id,aggregate_revision)
);
GRANT SELECT ON public.laboratory_public_settings TO dental_lab_app;
GRANT UPDATE(revision,fields,changed_by,changed_at) ON public.laboratory_public_settings TO dental_lab_app;
GRANT SELECT,INSERT ON public.laboratory_settings_events TO dental_lab_app;
