-- Prepared only. No runtime switch is registered by this migration.
CREATE TABLE public.maintenance_state (
 id uuid PRIMARY KEY CHECK(id='86000000-0000-4000-8000-000000000002'),
 active boolean NOT NULL DEFAULT false,
 message text NOT NULL DEFAULT '' CHECK(length(message)<=2000),
 planned_at timestamptz CHECK(planned_at IS NULL OR isfinite(planned_at)),
 planned_message text NOT NULL DEFAULT '' CHECK(length(planned_message)<=2000),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 changed_by uuid REFERENCES public.accounts(id),
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK(isfinite(changed_at)),
 CHECK(NOT active OR length(btrim(message))>0),
 CHECK(planned_at IS NULL OR length(btrim(planned_message))>0)
);
INSERT INTO public.maintenance_state(id) VALUES('86000000-0000-4000-8000-000000000002');
CREATE TABLE public.maintenance_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 revision bigint NOT NULL UNIQUE CHECK(revision>0),
 actor_id uuid NOT NULL REFERENCES public.accounts(id),
 request_id uuid NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK(isfinite(occurred_at)),
 before_state jsonb NOT NULL,
 after_state jsonb NOT NULL
);
GRANT SELECT ON public.maintenance_state,public.maintenance_events TO dental_lab_app;
GRANT UPDATE(active,message,planned_at,planned_message,revision,changed_by,changed_at) ON public.maintenance_state TO dental_lab_app;
GRANT INSERT ON public.maintenance_events TO dental_lab_app;
